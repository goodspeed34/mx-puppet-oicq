import { _ } from "./l10n";
import { ConfigWrap } from "./excfg";

import * as fs from "fs";
import * as yaml from "js-yaml";
import { split } from "shlex";
import { consoleAvatar, CONTROLLER_PARAMS } from "./oicq";
import { IPuppetData, IReceiveParams, IRemoteRoom, PuppetBridge } from "mx-puppet-bridge";
import { Client } from "oicq";

const HELP_MESSAGE = [ _("Welcome to the control room of mx-puppet-oicq!"),
		       _("    help    display this help"),
		       _("    status  show the status of the bridge"),
		       _("    show    show some useful details"),
		       _("    join    join in a chat") ].join("\n");

const WELCOME_MESSAGE =  _("    Welcome to the control room of mx-puppet-oicq!\n");

export class Controller
{
    // [x: string]: any;
    private cfg: ConfigWrap;
    private puppet: PuppetBridge;
    private client: Client;

    /* Construct controller from the config file. */
    constructor(cfgFile: string)
    {
        this.cfg = new ConfigWrap();
        this.cfg.applyConfig(yaml.load(fs.readFileSync(cfgFile).toString()));
    }

    /* Initialize backup functions for re-enable. */
    public installPuppet(puppet: PuppetBridge) {
        this.puppet = puppet;
    }

    /* Install OICQ client. */
    public installClient(client: Client)
    {
	this.client = client;
    }


    public send(room: IRemoteRoom, text: string)
    {
	let uparams = CONTROLLER_PARAMS;
	uparams.puppetId = room.puppetId;
	
	const params: IReceiveParams = {
	    room,
	    user: uparams
	};
	
	// text = prefix += text;
	this.puppet.sendMessage(params, { body: text } );
    }
    
    /* Console Command Handler */
    public handle(message: string, room: IRemoteRoom)
    {
	const cmd = split(message);

	switch (cmd[0]) {
	    case "help":
		this.send(room, HELP_MESSAGE)
		break;
	    case "status":
		let status = [ _(`OICQ Status: ${this.client.isOnline() ? "Online" : "Offline"} <${this.client.status}>`),
			       _(`OICQ Count: ${this.client.fl.size}, ${this.client.gl.size}, ${this.client.sl.size}`),
			       _(`OICQ I/O: ${this.client.stat.sent_msg_cnt}, ${this.client.stat.recv_msg_cnt}  ${this.client.stat.sent_pkt_cnt}, ${this.client.stat.recv_pkt_cnt}`)
			     ];
		this.send(room, status.join("\n"));
		break;
	    case "show":
		switch (cmd[1]) {
		    case "group":
		    case "groups":
			let gmsg = [ ];
			this.client.gl.forEach((g) => {
			    gmsg.push(_(`:---: ${g.group_name} [${g.group_id}]`));
			});
			this.send(room, gmsg.join("\n"));
			break;
		    case "friend":
		    case "friends":
			let fmsg = [ ];
			this.client.fl.forEach((f) => {
			    fmsg.push(_(`:---: ${f.nickname} [${f.user_id}]`));
			});
			this.send(room, fmsg.join("\n"));
			break;		
		    default:
			this.send(room, _("Usage: show <groups|friends>"));
		}
		break;
	    case "join":
		switch (cmd[1]) {
		    case "friend":
			this.send(room, _(`Please join @_OICQ__${cmd[2]}:${this.cfg.bridge.domain}`));
			break;
		    case "group":
			this.send(room, _(`Please join #_OICQ__${cmd[2]}:${this.cfg.bridge.domain}`));
			break;
		    default:
			this.send(room, _("Usage: join <friend|group> <ID>"));
		}
		break;
	    default:
		this.send(room, _("Command not found, enter \"help\" to show commands"));
	}
    }

    public initInstance()
    {
	if (!this.cfg.bridge.firstInit) {
	    return;
	}
	
	const data: IPuppetData = { name: "OICQ" };
	const user = this.cfg.control.user;
	
	if (!this.puppet.provisioner.canCreate(user)) {
	    console.log(_("Initial failed: Permission denied!"));
	}

	console.log(_("Setting up a new puppet!"));
	
	this.puppet.provisioner.new(user, data, user).then( (puppetId) => {
	    console.log(_(`Correctly created puppet ${puppetId}!`));
	    console.log(_("Setting up the global namespace!"));
	    this.puppet.provisioner.setIsGlobalNamespace(puppetId, true).then(() => {
		console.log(_("Sucessfully Initialized."));
		console.log(_("Please change firstInit to false!"));

		console.log(_("Inviting user to the control room!"));
		let uparams = CONTROLLER_PARAMS;
		uparams.puppetId = puppetId;
		
		const params: IReceiveParams = {
		    room: {
			puppetId: 1,
			roomId: "controld",
			avatarUrl: _(consoleAvatar),
			name: _("OICQ Puppet Bridge Control"),
			topic: _("OICQ BRIDGE CONSOLE"),
			isDirect: true
                    },
		    user: uparams
		};

		setTimeout(() => {
		    this.puppet.sendMessage(params, { body: WELCOME_MESSAGE }).then(() => {
			this.cfg.bridge.firstInit = false;
			fs.writeFile('config.yaml', yaml.dump(this.cfg), (err) => {
			    if (err) throw err;
			    console.log('Your configuration has been updated!');
			    process.kill(process.pid, 'SIGTERM')
			});
		    });
		}, 10000);
	    });
	});
    }
}
