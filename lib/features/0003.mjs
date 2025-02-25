export let mixinPrivate = {
  async init(base) {
    try {
        let res = await base.getFeature(0x0003);
        base.setFeatureIndex(0x0003, res.featureIndex);
    } catch (res) {
        console.error("failed to retrieve the featureIndex for DeviceInformation:", res.error);
    }
  }
};

export let mixin = {
    async getDeviceInfo() {
        const res = await this.sendReport(this.getFeatureIndex(0x0003), 0, new Uint8Array(0));
        return {
            entityCnt: res[0],
            unitId: this.toHex(res[1], 2) + this.toHex(res[1], 2) + this.toHex(res[3], 2) + this.toHex(res[4], 2),
            transportUSB: !!(res[6] & (1 << 3)),
            transportEQuad: !!(res[6] & (1 << 2)),
            transportBTLE: !!(res[6] & (1 << 1)),
            transportBT: !!(res[6] & 1),
            pids: new Uint16Array([
                    (res[7] << 8) +  res[8],
                    (res[9] << 8) +  res[10],
                    (res[11] << 8) +  res[12]
                ]),
            extendedModelId: res[13],
            hasSerialNumber: !!(res[14] & 1)
        }
    },

    async getFwInfo(entityIdx) {
        const request = new Uint8Array([entityIdx]);
        const res = await this.sendReport(this.getFeatureIndex(0x0003), 1, request);

        return {
            type: res[0],
            fwName: String.fromCharCode(res[1]) +
                    String.fromCharCode(res[2]) + 
                    String.fromCharCode(res[3]) + res[4],
            fwRevision: res[5],
            fwBuild: (res[6] << 8) + res[7],
            active: !!(res[8] & 1)
        };
    },

    async getDeviceSerialNumber() {
        const res = await this.sendReport(this.getFeatureIndex(0x0003), 2, new Uint8Array(0));
        let serial = "";

        for (let i=0; i<12; i++) {
            serial += String.fromCharCode(res[i]);
        }

        return {
            serialNumber: serial
        };
    }
};