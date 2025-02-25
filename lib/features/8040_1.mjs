export let mixinPrivate = {
  async init(base) {
    try {
        let res = await base.getFeature(0x8040);
        base.setFeatureIndex(0x8040, res.featureIndex);
    } catch (res) {
        console.error("failed to retrieve the featureIndex for FeatureSet:", res.error);
    }
  },

  handleEvent(base, data) {
    if (base.getFeatureIndex(0x8040) == data[0]) {
        const eventId = data[1];

        switch (eventId) {
            case 0x00:
                const brightness = (data[2] << 8) + data[3];
                if (base.onBCBrightnessChanged) {
                    base.onBCBrightnessChanged(brightness);
                }
                return true;

            case 0x10:
                const state = !!(data[2] & 1);
                if (base.onBCIlluminationChanged) {
                    base.onBCIlluminationChanged(state);
                }
                return true; 
        }  
    }
    return false;
  }
};

export let mixin = {
    onBCIlluminationChanged: null,
    onBCBrightnessChanged: null,

    async getBCInfo() {
        const res = await this.sendReport(this.getFeatureIndex(0x8040), 0, new Uint8Array(0));
        return {
            min: (res[4] << 8) + res[5],
            max: (res[0] << 8) + res[1],
            step: res[6],
            hwBrightness: !!(res[0] & 1),
            hasEvents: !!(res[0] & 2),
            illumination: !!(res[0] & 4),
            hwOnOff: !!(res[0] & 8),
            transient: !!(res[0] & 16),
        };
    },

    async getBCBrightness() {
        const res = await this.sendReport(this.getFeatureIndex(0x8040), 1, new Uint8Array(0));
        return (res[0] << 8) + res[1];
    },

    async setBCBrightness(value) {
        const request = new Uint8Array([(value & 0xFF00) >> 8, value & 0x00FF]);
        await this.sendReport(this.getFeatureIndex(0x8040), 2, request);
    },

    async getBCIllumination() {
        const res = await this.sendReport(this.getFeatureIndex(0x8040), 3, new Uint8Array(0));
        return !!(res[0] && 1);
    },

    async setBCIllumination(state) {
        const request = new Uint8Array([state ? 1 : 0]);
        await this.sendReport(this.getFeatureIndex(0x8040), 4, request);
    },
};