import { _ } from './l10n';
import * as fs from "fs";
import { ConfigWrap } from "./excfg";
import * as yaml from 'js-yaml';
import * as crypto from 'crypto';

const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(query, (answer) => resolve(answer)));

let id, pass, again, firstInit;

let config = new ConfigWrap();
config.applyConfig(yaml.load(fs.readFileSync('config.yaml').toString()));

console.log(config)

const get = (async () => {
    id = await ask(_("QQ Number: "));
    pass = await ask(_("Password: "));
    firstInit = await ask(_("Automatically initialize the bridge? "));
    again = await ask(_("Is it correct? "));
    if (again == 'n' || again == 'no')
    {
        get();
    } else {
	config.login = {
            id: Number(id.trim()),
            pass: crypto.createHash("md5")
                .update(pass.trim())
                .digest()
	};
	config.bridge.firstInit = firstInit;
	fs.writeFile('config.yaml', yaml.dump(config), (err) => {
	    if (err) throw err;
	    console.log('Your configuration has been updated!');
	    process.exit(0)
	});
    };
});

get();
