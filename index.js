#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const rl = require('readline').createInterface({input: process.stdin, output: process.stdout});
const question = util.promisify(rl.question).bind(rl);

if (process.argv.length < 4) {
    console.log("Usage: console-config <defaultsPath> <configPath>");
    return;
}

// main()
(async () => {
    const [defaultsPath, configPath] = process.argv.slice(2);

    // read in the existing config file
    // or the defaults file if there is no config file
    let config;
    try {
        config = await modifyConfig(configPath);
    }
    catch (e) {
        config = await modifyConfig(defaultsPath);
    }

    // iterate through config object allowing user modification
    await recurseInteractive(config, '');

    // check if the user is happy with the result before writing it to disk
    console.log(`New config:\n${JSON.stringify(config, 0, 4)}`);
    const answer = await question(`Write to ${configPath}? [Y/n]`);
    if (!answer.match(/[nN]/)) {
        await fs.promises.writeFile(configPath, JSON.stringify(config, 0, 4), 'utf-8');
        console.log('Saved!');
    }

    // close readline interface or the script will hang
    rl.close();
})();

async function modifyConfig(path) {
    // read and parse input file
    const config = JSON.parse(await fs.promises.readFile(path));
    console.log(`Loaded ${path}`);
    return config;
}

async function recurseInteractive(config, parentPath) {
    for (const key in config) {
        // dot-delimited path for displaying nested object keys
        const path = parentPath ? `${parentPath}.${key}` : key;

        // recurse on object
        if (_.isPlainObject(config[key])) {
            await recurseInteractive(config[key], path);
        }

        // TODO: recurse arrays? (haven't thought of an intuitive UX for that)

        else {
            // ask the user if they want to change this value
            let input = await question(`${path} [Default=${JSON.stringify(config[key])}]: `);
            
            // if we get any visible characters from them, attempt to override the config value
            input = _.trim(input); 
            if (input) {
                config[key] = parseConsoleInput(input, config[key]);
            }
        }
    }
}

function parseConsoleInput(input, originalValue) {
    // start by attempting JSON.parse()
    try {
        input = JSON.parse(input);
    }
    catch (err) {
        // if the original value is an array
        if (_.isArray(originalValue)) {
            // if they gave us an array that contains unquoted strings, we can fix that for them
            input = _.map([...input.matchAll(/([\[,])([^\],]+)/g)], matches => {
                try {
                    return JSON.parse(matches[2]);
                }
                catch (e) {
                    return _.trim(matches[2]);
                }
            });

            // if it was an utter failure, restore the original array
            if (!input.length) {
                input = originalValue;
            }
        }

        // if it wasn't an array at all, we'll just assume they wanted their input as a string
    }

    return input;
}
