export let mixinPrivate = {
  async init(base) {
    try {
        let res = await base.getFeature(0x1990);
        base.setFeatureIndex(0x1990, res.featureIndex);
    } catch (res) {
        console.error("failed to retrieve the featureIndex for DeviceInformation:", res.error);
    }
  },

  handleEvent(base, data) {
    if (base.getFeatureIndex(0x1990) == data[0]) {
        const eventId = data[1];

        switch (eventId) {
            case 0x00:
                const state = !!(data[2] & 1);
                if (base.onIlluminationChanged) {
                    base.onIlluminationChanged(state);
                }
                return true;

            case 0x10:
                const brightness = (data[2] << 8) + data[3];
                if (base.onBrightnessChanged) {
                    base.onBrightnessChanged(brightness);
                }
                return true;

            case 0x20: 
                const ct = (data[2] << 8) + data[3];
                if (base.onColorTemperatureChanged) {
                    base.onColorTemperatureChanged(ct);
                }
                return true;            
        }  
    }
    return false;
  }
};

export let mixin = {
    onIlluminationChanged: null,
    onBrightnessChanged: null,
    onColorTemperatureChanged: null,

    async getIllumination() {
        const res = await this.sendReport(this.getFeatureIndex(0x1990), 0, new Uint8Array(0));
        return !!(res[0] & 1);
    },

    async setIllumination(state) {
        const request = new Uint8Array([state ? 1 : 0]);
        await this.sendReport(this.getFeatureIndex(0x1990), 1, request);
    },

    async getBrightnessInfo() {
        const res = await this.sendReport(this.getFeatureIndex(0x1990), 2, new Uint8Array(0));
        return {
            hasEvents: !!(res[0] & 1),
            hasLinearLevels: !!(res[0] & 2),
            hasNonLinearLevels: !!(res[0] & 3),
            hasNonLinearLevels: !!(res[0] & 3),
            min: (res[1] << 8) + res[2],
            max: (res[3] << 8) + res[4],
            step: (res[5] << 8) + res[6],
            levels: res[7] % 0x0F
        };
    },

    async getBrightness() {
        const res = await this.sendReport(this.getFeatureIndex(0x1990), 3, new Uint8Array(0));
        return (res[0] << 8) + res[1];
    },

    async setBrightness(value) {
        const request = new Uint8Array([(value & 0xFF00) >> 8, value & 0x00FF]);
        await this.sendReport(this.getFeatureIndex(0x1990), 4, request);
    },
    
    // Skipping brightness levels methods

    async getColorTemperatureInfo() {
        const res = await this.sendReport(this.getFeatureIndex(0x1990), 7, new Uint8Array(0));
        return {
            hasEvents: !!(res[0] & 1),
            hasLinearLevels: !!(res[0] & 2),
            hasNonLinearLevels: !!(res[0] & 3),
            hasNonLinearLevels: !!(res[0] & 3),
            min: (res[1] << 8) + res[2],
            max: (res[3] << 8) + res[4],
            step: (res[5] << 8) + res[6],
            levels: res[7] % 0x0F
        };
    },

    async getColorTemperature() {
        const res = await this.sendReport(this.getFeatureIndex(0x1990), 8, new Uint8Array(0));
        return (res[0] << 8) + res[1];
    },

    async setColorTemperature(value) {
        const request = new Uint8Array([(value & 0xFF00) >> 8, value & 0x00FF]);
        await this.sendReport(this.getFeatureIndex(0x1990), 9, request);
    }
    
    // Skipping color temperature levels methods
};