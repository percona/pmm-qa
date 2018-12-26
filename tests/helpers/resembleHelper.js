'use strict';

// use any assertion library you like
const resemble = require("resemblejs");
const fs = require('fs');
let assert = require('assert');

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
    async _compareImages (image1, image2, diffImage, options) {
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
    async _fetchMisMatchPercentage (image1, image2, diffImage, options) {
        var result = this._compareImages(image1, image2, diffImage, options);
        var data = await Promise.resolve(result);
        return data.misMatchPercentage;
    }

    /**
     * Miss match Percentage Verification
     * @param baseImage
     * @param screenShotImage
     * @param diffImageName
     * @param tolerance
     * @param prepareBase
     * @param options
     */
    async verifyMisMatchPercentage(baseImage, screenShotImage, diffImageName, tolerance = 10, prepareBase = false, options){
        if (prepareBase)
        {
            this.prepareBaseImage(baseImage, screenShotImage);
        }
        else
        {
            var misMatch = await this._fetchMisMatchPercentage(baseImage, screenShotImage, diffImageName, options);
            console.log("MisMatch Percentage Calculated is " + misMatch);
            assert.ok(misMatch < tolerance, "MissMatch Percentage" + misMatch);
        }
    }

    /**
     * Function to prepare Base Images from Screenshots
     *
     * @param baseImage
     * @param screenShotImage
     */
    prepareBaseImage(baseImage, screenShotImage) {

        fs.copyFile(this.config.screenshotFolder + screenShotImage, this.config.baseFolder + baseImage, (err) => {
            if (err) throw err;
            console.log('Base Image created for ' + screenShotImage);
        });
    }
}

module.exports = ResembleHelper;
