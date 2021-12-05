/*
 * This is a list of args used below...
 * You can change these values if you know it.
 */
const REG_FILE  = "oicq-registration.yaml";
const CONF_FILE = "config.yaml";
// Bridge Settings
const SERV_ID   = "oicq";
const DISPLAY   = "OICQ";
const NPATRN    = {
    user: ":name",
    room: ":name",
    group: ":name"
};

/* import mx-puppet-bridge pack */
import { App } from './oicq';
import { _ } from './l10n';
import {
    IRetData,
    PuppetBridge,
    IProtocolInformation,
    IPuppetBridgeRegOpts
} from 'mx-puppet-bridge';

/* process commandline input */
import * as commandLineArgs from "command-line-args";
import * as commandLineUsage from "command-line-usage";
import { Controller } from './control';

// Define commandline option list.
const cmdopts = [
    { name: "register", alias: "r", type: Boolean },
    { name: "registration-file", alias: "f", type: String },
    { name: "config", alias: "c", type: String },
    { name: "help", alias: "h", type: Boolean }
];
const opts = Object.assign({
    "register": false,
    "registration-file": REG_FILE,
    "config": CONF_FILE,
    "help": false
}, commandLineArgs(cmdopts));
// Generate help messages.
if (opts.help)
{
    console.log(commandLineUsage([
	{
	    header: "Matrix oicq Puppet Bridge",
	    content: "A matrix puppet bridge for oicq",
	},
	{
	    header: "Options",
	    optionList: cmdopts,
	}
    ]));
    process.exit(0);
};

/* Get our protocal ready! */
const proto =
      {
	  features: {
              presence: false,
              image: true,
              video: true,
              audio: true,
              globalNamespace: true
	  },
	  id: SERV_ID,
	  displayname: DISPLAY,
	  namePatterns: NPATRN
      } as IProtocolInformation;

// Initialize our bridge.
const puppet = new PuppetBridge(
    opts["registration-file"],
    opts.config, proto
)

// Generate a configuration file.
if (opts.register)
{
    puppet.readConfig(false);
    try {
        puppet.generateRegistration({
            prefix: `_${DISPLAY}_`, id: `${SERV_ID}-puppet`,
            url: `http://${puppet.Config.bridge.bindAddress}:${puppet.Config.bridge.port}`
        } as IPuppetBridgeRegOpts);
    } catch (err) {
        console.log("", err);
    }
    process.exit(0);
}

// Bind OICQ func to puppet bridge & run.
async function run()
{
    await puppet.init();
    let oicq: App;
    const controller = new Controller(opts.config);
    oicq = new App(puppet, {}, controller);
    await oicq.init(opts.config);
    puppet.on("puppetNew", oicq.newPuppet.bind(oicq));
    puppet.on("puppetDelete", oicq.deletePuppet.bind(oicq));
    puppet.on("message", oicq.handleMatrixMessage.bind(oicq));
    puppet.on("image", oicq.handleMatrixImage.bind(oicq));
    puppet.on("video", oicq.handleMatrixVideo.bind(oicq));
    puppet.on("audio", oicq.handleMatrixAudio.bind(oicq));
    puppet.setCreateUserHook(oicq.createUser.bind(oicq));
    puppet.setCreateRoomHook(oicq.createRoom.bind(oicq));
    puppet.setListUsersHook(oicq.listUsers.bind(oicq));
    puppet.setListRoomsHook(oicq.listRooms.bind(oicq));
    puppet.setGetUserIdsInRoomHook(oicq.getUserIdsInRoom.bind(oicq));
    puppet.setGetDmRoomIdHook(oicq.getDmRoom.bind(oicq));
    puppet.setGetDescHook(async (_: number, data: any): Promise<string> => {
	let s = "oicq";
	if (data.self) {
	    s += ` as \`${data.self.name}\``;
	}
	return s;
    });
    puppet.setBotHeaderMsgHook((): string => {
	return "OICQ Puppet Bridge";
    });
    puppet.setGetDataFromStrHook(async (_: string): Promise<IRetData> => {
        const retData: IRetData = {
	    success: true,
	};
        retData.data = {
            name: "OICQ" 
        };
        return retData;
    });
    await puppet.start();
}

run();
