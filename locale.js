import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {$} from 'execa';

import {debug, verbose, info, error} from './logger.js';
import { searchReplace } from "./utility.js";

export default class Locale {
    /**
     * The configuration, containing array of locales to enable
     * @type {string[]}
    */
    #config

    /**
     * 
     * @param {string[]} config array of locales to enable, first being the one that LANG gets set to
     */
    constructor(config) {
        this.#config = config;
    }

    async preChroot(globalConf) {
        const { root } = globalConf;
        
        info('Enabling locales in /etc/locale.gen');
        let replaces = [];
        for (let locale of this.#config) {
            verbose(`Enabling ${locale}`);
            replaces.push({search: '#' + locale, replace: locale});
        }
        await searchReplace(path.join(root, 'etc/locale.gen'), replaces);

        const firstLocale = this.#config[0].split(' ')[0];
        info(`Creating /etc/locale.conf with LANG=${firstLocale}`);
        await fs.writeFile(path.join(root, 'etc/locale.conf'), `LANG=${firstLocale}` + os.EOL);
    }

    async postChroot(globalConf) {
        info('Calling locale-gen');
        await $`locale-gen`;
    }
}