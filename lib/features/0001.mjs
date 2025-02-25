export let mixinPrivate = {
  async init(base) {
    try {
        let res = await base.getFeature(0x0001);
        base.setFeatureIndex(0x0001, res.featureIndex);
    } catch (res) {
        console.error("failed to retrieve the featureIndex for FeatureSet:", res.error);
    }
  }
};

export let mixin = {
    async getCount() {
        const res = await this.sendReport(this.getFeatureIndex(0x0001), 0, new Uint8Array(0));
        return res[0];
    },

    async getFeatureId(featureIndex) {
        const request = new Uint8Array([featureIndex]);
        const res = await this.sendReport(this.getFeatureIndex(0x0001), 1, request);

        return {
            featureId: (res[0] << 8) + res[1],
            obsolete: !!(res[2] & (1<<7)),
            hidden: !!(res[2] & (1<<6)),
            engeneering: !!(res[2] & (1<<5)),
            manufacturing_deactivatable: !!(res[2] & (1<<4)),
            compliance_deactivatable: !!(res[2] & (1<<3)),
            featureVersion: res[3]
        };
    }
};