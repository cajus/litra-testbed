const DEVICE_INDEX = 0xff;
const SOFTWARE_ID = 0x0d;

const ERRORS = {
  0: "Not an error",
  1: "Unknown error",
  2: "Invalid argument",
  3: "Out of range",
  4: "Hardware error",
  5: "Internal error",
  6: "Invalid feature index",
  7: "Invalid function ID",
  8: "Device is busy",
  9: "Not supported"
};

export class LitraDevice {
  #device = null;
  #deviceView = null;
  #parentElement = null;
  #valid = false;

  #inputReportID = 0;
  #inputReportCount = 0;
  #outputReportID = 0;
  #outputReportCount = 0;

  #srCallbacks = [];
  #evHandlers = [];
  #featureIndexMap = {};

  constructor(device) {
    this.#device = device;

    // Simplified - look for the first valid application collection that
    // has input/output reportIds and the HID++ usage page.
    for (let collection of device.collections) {
      if (collection.type === APPLICATION &&
        this.#isLongCollection(collection) &&
        collection.usagePage === HIDPP20_USAGE_PAGE) {

        for (let inputReport of collection.inputReports) {
          this.#inputReportID = inputReport.reportId;
          if (inputReport.items.length) {
            this.#inputReportCount = inputReport.items[0].reportCount;
          }
          break;
        }

        for (let outputReport of collection.outputReports) {
          this.#outputReportID = outputReport.reportId;
          if (outputReport.items.length) {
            this.#outputReportCount = outputReport.items[0].reportCount;
          }
          break;
        }

        this.#valid = !!this.#inputReportID && !!this.#outputReportID &&
          !!this.#inputReportCount && !!this.#outputReportCount;
      }
    }
  }

  setFeatureIndex(feature, index) {
    this.#featureIndexMap[feature] = index;
  }

  getFeatureIndex(feature) {
    return this.#featureIndexMap[feature] ?? -1;
  }

  async init() {
    if (!this.#valid || !this.#device) return;

    await this.#device.open();
    this.#device.oninputreport = ev => this.#handleInputReport(ev);

    await this.#loadFeature(0x0000); // Root Feature
    await this.#loadFeature(0x0001); // Feature Set

    const featureCount = await this.getCount();
    for (let index = 1; index <= featureCount; index++) {
      const featureInfo = await this.getFeatureId(index);
      if (!featureInfo.hidden) {
        await this.#loadFeature(featureInfo.featureId, featureInfo.featureVersion);
      }
    }

    navigator.hid.addEventListener("disconnect", event => {
      if (event.device == this.#device) {
        if (this.#parentElement) {
          this.#deviceView.remove();
        }

        delete this;
      }
    });
  }

  async #loadFeature(featureId, version = 0) {
    try {
      let vs = version === 0 ? "" : `_${version}`;
      const feature = await import('./features/' + this.toHex(featureId, 4) + vs + '.mjs')
      Object.assign(this, feature.mixin);
      await feature.mixinPrivate.init(this);

      if ("handleEvent" in feature.mixinPrivate) {
        this.#evHandlers.push(feature.mixinPrivate.handleEvent);
      }

    } catch {
      console.info("No feature 0x" + this.toHex(featureId, 4) + " found - skipping");
    }
  }

  sendReport(featureIndex, functionID, data, pingPosition = -1) {
    let _data = new Uint8Array(this.#inputReportCount);
    _data[0] = DEVICE_INDEX;
    _data[1] = featureIndex;
    _data[2] = ((functionID & 0x0F) << 4) + (SOFTWARE_ID & 0x0F);
    _data.set(data, 3);
    return this.#sendReport(this.#inputReportID, _data, pingPosition === -1 ? -1 : pingPosition + 3);
  }

  #sendReport(reportId, data, pingPosition = -1) {
    return new Promise((resolve, reject) => {
      this.#srCallbacks.push({
        deviceIndex: data[0],
        featureIndex: data[1],
        functionID: data[2],
        resolve: resolve,
        reject: reject,
        pingPosition: pingPosition,
        pingData: pingPosition > 2 && pingPosition < data.length ? data[pingPosition] : 0
      });

      this.#device.sendReport(reportId, data);
    });
  }

  #handleInputReport(event) {
    const { data, device, reportId } = event;

    if (data.byteLength != 19 || reportId != this.#outputReportID) {
      console.log("blocked");
      return;
    }

    let deviceIndex = data.getUint8(0);
    let featureIndex = data.getUint8(1);
    let functionID = data.getUint8(2);

    // Handle error
    if (deviceIndex == 0xFF &&
      featureIndex == 0xFF) {
      deviceIndex = data.getUint8(1);
      featureIndex = data.getUint8(2);
      functionID = data.getUint8(3);
      const errorCode = data.getUint8(4);
      let errorText = Object.keys(ERRORS).length <= errorCode ?
        ERRORS[errorCode] : "Unknown error";

      for (let i = 0; i < this.#srCallbacks.length; i++) {
        const sr = this.#srCallbacks[i];

        if (sr.deviceIndex === deviceIndex &&
          sr.featureIndex === featureIndex &&
          sr.functionID === functionID) {

          sr.reject({
            code: errorCode,
            error: errorText
          });

          this.#srCallbacks.splice(i, 1);
          break;
        }
      }

      return;
    }

    // Handle response?
    for (let i = 0; i < this.#srCallbacks.length; i++) {
      const sr = this.#srCallbacks[i];

      if (sr.deviceIndex == deviceIndex &&
        sr.featureIndex == featureIndex &&
        sr.functionID == functionID &&
        (sr.pingPosition < 3 || sr.pingData == data.getUint8(sr.pingPosition))) {

        sr.resolve(new Uint8Array(data.buffer.slice(3)));
        this.#srCallbacks.splice(i, 1);
        return;
      }
    }

    // Handle event
    const evData = new Uint8Array(data.buffer.slice(1));
    for (let handler of this.#evHandlers) {
      if (handler(this, evData)) {
        return;
      }
    }

    // DEBUG
    //let value = "";
    //for (let i = 0; i < data.byteLength; i++) {
    //  value += this.toHex(data.getUint8(i), 2) + " ";
    //}
    //console.log(`output event received: ${value}`);
    // DEBUG
  }

  #isLongCollection(collection) {
    // First byte is a bitmask of supported data types
    //   1: short 2: long 4: very long
    // Second byte is the actual type of this collection,
    // the meaning is the same as in the bitmask.
    //
    // We only need to support collections with the long type.
    return (collection.usage & 0x0202) === 0x0202;
  }

  toHex(value, len) {
    return (Number(value).toString(16)).slice(-len).toUpperCase().padStart(len, "0");
  }

  async render(parentElement) {
    this.#parentElement = parentElement;
    const template = document.getElementById("litraDeviceTemplate");

    const deviceView = template.content.cloneNode(true);

    // Set card title
    deviceView.querySelector("#cardTitle").textContent = await this.getDeviceName();

    // Wire illumiation button
    const switchButton = deviceView.querySelector("#switchButton")
    const switchValue = deviceView.querySelector("#switchValue")

    switchButton.checked = await this.getIllumination();
    switchValue.textContent = switchButton.checked ? "On" : "Off";

    switchButton.onclick = async event => {
      this.setIllumination(switchButton.checked);
      switchValue.textContent = switchButton.checked ? "On" : "Off";
    };

    this.onIlluminationChanged = (state) => {
      switchValue.checked = state;
    };

    // Wire brightness slider
    const brightness = deviceView.querySelector("#brightnessSlider")
    const brightnessValue = deviceView.querySelector("#brightnessValue")

    const brightnessInfo = await this.getBrightnessInfo();
    brightness.min = brightnessInfo.min;
    brightness.max = brightnessInfo.max;
    brightness.step = brightnessInfo.step;
    brightness.value = await this.getBrightness();
    brightnessValue.textContent = brightness.value + " lm";

    brightness.onchange = async event => {
      this.setBrightness(brightness.value);
    }

    brightness.oninput = async event => {
      brightnessValue.textContent = event.target.value + " lm";
    }

    this.onBrightnessChanged = (value) => {
      brightness.value = value;
      brightnessValue.textContent = value + " lm";
    };

    // Wire color temperature slider
    const ct = deviceView.querySelector("#ctSlider")
    const ctValue = deviceView.querySelector("#ctValue")

    const ctInfo = await this.getColorTemperatureInfo();
    ct.min = ctInfo.min;
    ct.max = ctInfo.max;
    ct.step = ctInfo.step;
    ct.value = await this.getColorTemperature();
    ctValue.textContent = ct.value + " K";

    ct.onchange = async event => {
      this.setColorTemperature(ct.value);
    }

    ct.oninput = async event => {
      ctValue.textContent = event.target.value + " K";
    }

    this.onColorTemperatureChanged = (value) => {
      ct.value = value;
      ctValue.textContent = value + " K";
    };

    if ("getBCIllumination" in this) {
      // Wire BC illumiation button
      deviceView.querySelector("#rgbControls").style.display = "block";

      const bcSwitchButton = deviceView.querySelector("#bcSwitchButton")
      const bcSwitchValue = deviceView.querySelector("#bcSwitchValue")

      bcSwitchButton.checked = await this.getBCIllumination();
      bcSwitchValue.textContent = bcSwitchButton.checked ? "On" : "Off";

      bcSwitchButton.onclick = async event => {
        this.setBCIllumination(bcSwitchButton.checked);
        bcSwitchValue.textContent = bcSwitchButton.checked ? "On" : "Off";
      };

      this.onBCIlluminationChanged = (state) => {
        bcSwitchValue.checked = state;
      };

      // Wire BC brightness slider
      const bcBrightness = deviceView.querySelector("#bcBrightnessSlider")
      const bcBrightnessValue = deviceView.querySelector("#bcBrightnessValue")

      const bcBbrightnessInfo = await this.getBCInfo();
      bcBrightness.min = bcBbrightnessInfo.min;
      bcBrightness.max = bcBbrightnessInfo.max;
      bcBrightness.step = bcBbrightnessInfo.step;
      bcBrightness.value = await this.getBCBrightness();
      bcBrightnessValue.textContent = bcBrightness.value + " %";

      bcBrightness.onchange = async event => {
        this.setBCBrightness(bcBrightness.value);
      }

      bcBrightness.oninput = async event => {
        bcBrightnessValue.textContent = event.target.value + " %";
      }

      this.onBCBrightnessChanged = (value) => {
        bcBrightness.value = value;
        bcBrightnessValue.textContent = value + " %";
      };

      // Wire color picker
      const colorPicker = deviceView.querySelector("#colorPicker")
      colorPicker.oninput = async event => {
        let v = colorPicker.value;
        this.setRGB(
          parseInt(v.slice(1,3), 16),
          parseInt(v.slice(3,5), 16),
          parseInt(v.slice(5,7), 16),
        );
      }
    }

    // Wire close button
    const closeButton = deviceView.querySelector("#closeButton")
    closeButton.onclick = () => {
      this.#deviceView.remove();
      this.#device.forget();
      delete this;
    }

    this.#deviceView = parentElement.appendChild(deviceView.firstElementChild);
  }
}
