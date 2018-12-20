'use strict';

// use any assertion library you like
const resemble = require("resemblejs");
const fs = require('fs');

/**
 * Resemble.js helper class for CodeceptJS, this allows screen comparison
 */
class ResembleHelper extends codecept_helper {

    constructor(config) {
        super(config);
    }

    /**
     *
     * @param image1
     * @param image2
     * @param diffImage
     * @param options
     * @returns {Promise<any | never>}
     */
    async compareImages (image1, image2, diffImage, options) {
        image1 = this.config.baseFolder + image1;
        image2 = this.config.screenshotFolder + image2;

        return new Promise((resolve, reject) => {
            resemble.compare(image1, image2, options, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                    if (data.misMatchPercentage >= 1) {
                        fs.writeFile(this.config.diffFolder + diffImage + '.png', data.getBuffer(), (err, data) => {
                            if (err) {
                                throw new Error(this.err);
                            }
                        });
                    }
                }
            });
        }).catch((error) => {
            console.log('caught', error.message);
        });
    }

    /**
     *
     * @param image1
     * @param image2
     * @param diffImage
     * @param options
     * @returns {Promise<*>}
     */
    async fetchMisMatchPercentage (image1, image2, diffImage, options) {
        var result = this.compareImages(image1, image2, diffImage, options);
        var data = await Promise.resolve(result);
        return data.misMatchPercentage;
    }
}

module.exports = ResembleHelper;
