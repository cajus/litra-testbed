export let mixinPrivate = {
  featureIndex: -1,

  async init(base) {
    try {
        let res = await base.getFeature(0x0005);
        base.setFeatureIndex(0x0005, res.featureIndex);
    } catch (res) {
        console.error("failed to retrieve the featureIndex for DeviceInformation:", res.error);
    }
  }
};

export let mixin = {
    typeInfo: {
        0: "Keyboard",
        1: "Remote Control",
        2: "Numpad",
        3: "Mouse",
        4: "Trackpad",
        5: "Trackball",
        6: "Presenter",
        7: "Receiver",
        8: "Headset",
        9: "Webcam",
        10: "Steering Wheel",
        11: "Joystick",
        12: "Gamepad",
        13: "Dock",
        14: "Speaker",
        15: "Microphone",
        16: "Illumination Light",
        17: "Programmable Controller",
        18: "Car Sim Pedals",
        19: "Adapter"
    },

    async getDeviceNameCount() {
        const res = await this.sendReport(this.getFeatureIndex(0x0005), 0, new Uint8Array(0));
        return res[0];
    },

    async _getDeviceName(charIndex, len) {
        const request = new Uint8Array([charIndex]);
        const res = await this.sendReport(this.getFeatureIndex(0x0005), 1, request);

        let nameFragment = "";

        for (let i=0; i<len; i++) {
            nameFragment += String.fromCharCode(res[i]);
        }

        return nameFragment;
    },

    async getDeviceName() {
        let name = "";
        const len = await this.getDeviceNameCount();
        const steps = Math.floor(len / 16);
        const remainder = len % 16;

        for (let i = 0; i <= steps; i++) {
            name += await this._getDeviceName(i * 16, i === 0 ? remainder : 16);
        }

        return name;
    },

    async getDeviceType() {
        const res = await this.sendReport(this.getFeatureIndex(0x0005), 2, new Uint8Array(0));
        const idx = res[0];

        return {
            type: idx,
            info: idx in typeInfo ? typeInfo[idx] : "unknown"
        };
    }
};