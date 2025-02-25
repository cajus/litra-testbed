export let mixinPrivate = {
  featureIndex: 0,

  init(base) {
  }
};

export let mixin = {
  async getFeature(featId) {
    const request = new Uint8Array(2);
    request[0] = (featId & 0xFF00) >> 8;
    request[1] = featId & 0x00FF;

    const res = await this.sendReport(mixinPrivate.featureIndex, 0, request);
    return {
      featureIndex: res[0],
      obsolete: !!(res[1] & (1<<7)),
      hidden: !!(res[1] & (1<<6)),
      engeneering: !!(res[1] & (1<<5)),
      manufacturing_deactivatable: !!(res[1] & (1<<4)),
      compliance_deactivatable: !!(res[1] & (1<<3)),
      featureVersion: res[2]
    }
  },

  async getProtocolVersion() {
    const pingData = Math.floor(Math.random() * 255);
    const request = new Uint8Array([0, 0, pingData]);

    const res = await this.sendReport(mixinPrivate.featureIndex, 1, request, 2);

    return {
      protocolNum: res[0],
      targetSw: res[1]
    };
  }
};