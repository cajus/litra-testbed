const LOGITECH_VENDOR_ID = 0x046D;
const HIDPP20_USAGE_PAGE = 0xFF43;
const APPLICATION = 0x01;
let hidpp = null;

// TODO
let d = null;
if (!("hid" in navigator)) {
  window.location.replace("browser.html");
}

async function initialize() {
  hidpp = await import('./lib/LitraDevice.mjs')

  // Check if we've already connected devices
  navigator.hid.getDevices().then(devices => {
    if (devices.length == 0) {
      console.log(`No HID devices selected. Press the "request device" button.`);
      return;
    }
    
    devices.forEach(dev => initDevice(dev));
  });
}

async function initDevice(device) {
  if (device) {
    let dev = new hidpp.LitraDevice(device);
    await dev.init();
    
    dev.render(litraSpace);

    //TEST
    d = dev;
  }
}

// Wire add device button
requestDeviceButton.onclick = async event => {
  try {
    const filters = [
      { usage: 0x0202, vendorId: LOGITECH_VENDOR_ID, usagePage: HIDPP20_USAGE_PAGE },
      { usage: 0x0302, vendorId: LOGITECH_VENDOR_ID, usagePage: HIDPP20_USAGE_PAGE },
      { usage: 0x0602, vendorId: LOGITECH_VENDOR_ID, usagePage: HIDPP20_USAGE_PAGE },
      { usage: 0x0702, vendorId: LOGITECH_VENDOR_ID, usagePage: HIDPP20_USAGE_PAGE },
    ];

    const devices = await navigator.hid.requestDevice({ filters });
    devices.forEach(dev => initDevice(dev));
  } catch(e) {
    // TODO
    console.log(e);
  }
};

initialize();

navigator.hid.addEventListener("connect", event => {
  if (event.device) {
    if (event.device.vendorId == LOGITECH_VENDOR_ID) {
      initDevice(event.device);
    }
  }
});

