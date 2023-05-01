const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const chars = {
    '[': ']',
    '{': '}'
};
const any = (iteree, iterator) => {
    let result;
    for (let i = 0; i < iteree.length; i++) {
        result = iterator(iteree[i], i, iteree);
        if (result) {
            break;
        }
    }
    return result;
};
const jsonify = (almostJson) => {
    try {
        return JSON.parse(almostJson);
    } catch (e) {
        almostJson = almostJson.replace(/([a-zA-Z0-9_$]+\s*):/g, '"$1":').replace(/'([^']+?)'([\s,\]\}])/g, '"$1"$2');
        return JSON.parse(almostJson);
    }
};
const extract = (str) => {
    let startIndex = str.search(/[\{\[]/);
    if (startIndex === -1) {
        return null;
    }

    let openingChar = str[startIndex];
    let closingChar = chars[openingChar];
    let endIndex = -1;
    let count = 0;

    str = str.substring(startIndex);
    any(str, (letter, i) => {
        if (letter === openingChar) {
            count++;
        } else if (letter === closingChar) {
            count--;
        }

        if (!count) {
            endIndex = i;
            return true;
        }
    });

    if (endIndex === -1) {
        return null;
    }

    let obj = str.substring(0, endIndex + 1);
    return obj;
};

module.exports = class Utils {
    constructor() { }

    /**
     * @param {string} str
     * @returns {JSON}
     */
    static extractJSON(str) {
        let result;
        const objects = [];
        while ((result = extract(str)) !== null) {
            try {
                let obj = jsonify(result);
                objects.push(obj);
            } catch (e) {}
            str = str.replace(result, '');
        }

        return objects;
    }

    static mergeDefault(def, given) {
        if (!given) return def;
        for (const key in def) {
            if (!has(given, key) || given[key] === undefined) {
                given[key] = def[key];
            } else if (given[key] === Object(given[key])) {
                given[key] = Util.mergeDefault(def[key], given[key]);
            }
        }

        return given;
    }
}