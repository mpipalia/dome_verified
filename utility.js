import fs from 'node:fs/promises';

/**
 * Search and replace data in a file
 * @param {string} file The file whose data to replace
 * @param {{search: string|RegExp, replace: string}[]} replaces An array of search/replace
 */
export async function searchReplace(file, replaces) {
    let data = await fs.readFile(file, { encoding: 'utf-8'});
    for (const r of replaces) {
        data = data.replace(r.search, r.replace);
    }
    await fs.writeFile(file, data);
}