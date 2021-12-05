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

let port, user, addr, hUrl, domain, id, pass, again, firstInit;

let config = new ConfigWrap();

const get = (async () => {
    port = await ask(_("Which port you want the bridge bind to? "));
    addr = await ask(_("Which address you want the bridge listen on? "));
    domain = await ask(_("What's the domain name of the homeserver (e.g. example.com)? "));
    hUrl = await ask(_("Your homeserver url (start with http(s)://): "));
    user = await ask(_("Your username (e.g. root): "));
    
    id = await ask(_("QQ Number: "));
    pass = await ask(_("Password: "));
    firstInit = true;
    again = await ask(_("Is it correct? "));
    if (again == 'n' || again == 'no')
    {
        get();
    } else {
	config.bridge = {
	    bindAddress: addr,
	    port,
	    domain,
	    firstInit,
	    homeserverUrl: hUrl
	};

	config.database = {
	    filename: "database.db"
	};
	
	config.provisioning = {
	    whitelist: [`@${user}:${domain}`]
	};
	
	config.login = {
            id: Number(id.trim()),
            pass: crypto.createHash("md5")
                .update(pass.trim())
                .digest()
	};

	config.control = {
	    user: `@${user}:${domain}`
	};
	
	fs.writeFile('config.yaml', yaml.dump(config), (err) => {
	    if (err) throw err;
	    console.log('Your configuration has been updated!');
	    process.exit(0)
	});
    };
});

get();
