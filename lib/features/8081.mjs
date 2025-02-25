export let mixinPrivate = {
    async init(base) {
        try {
            let res = await base.getFeature(0x8081);
            base.setFeatureIndex(0x8081, res.featureIndex);
        } catch (res) {
            console.error("failed to retrieve the featureIndex for FeatureSet:", res.error);
        }
    }
};

export let mixin = {

    async getRGBZonesInfo() {
        const zones = [];

        for (let zoneRange = 0; zoneRange < 3; zoneRange++) {
            const res = await this.sendReport(this.getFeatureIndex(0x8081), 0, new Uint8Array([zoneRange, 0]));
            for (let i = 2; i < res.byteLength; i++) {
                for (let b = 0; b < 8; b++) {
                    if (res[i] & (1 << b)) {
                        zones.push((zoneRange * 14 * 8) + (i - 2) * 8 + b);
                    }
                }
            }
        }

        return zones;
    },

    async setIndividualRgbZones(data) {
        await this.sendReport(this.getFeatureIndex(0x8081), 1, data);
    },

    async frameEnd(persistence, currentFrame, nFramesTillNextChange) {
        const request = new Uint8Array([
            persistence, 
            (currentFrame & 0xFF00) >> 8,
            currentFrame & 0x00FF,
            (nFramesTillNextChange & 0xFF00) >> 8,
            nFramesTillNextChange & 0x00FF]
        );
        await this.sendReport(this.getFeatureIndex(0x8081), 7, request);
    },

    async setRGB(r, g, b) {
        let zones = await this.getRGBZonesInfo();

        const preseed = [];
        let count = 4;
        for (let i = 0; i < zones.length; i++) {
            let zone = zones[i];
            preseed.push(zone, r, g, b);

            if (--count == 0) {
                const data = new Uint8Array(preseed);
                await this.setIndividualRgbZones(data);
                preseed.length = 0;
                count = 4;
            }
        }

        if (count) {
            const data = new Uint8Array(preseed);
            await this.setIndividualRgbZones(data);
        }

        await this.frameEnd(1, 0, 0);
    }
};