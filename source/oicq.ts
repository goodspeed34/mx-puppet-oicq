import { _ } from "./l10n";
import { ConfigWrap } from "./excfg";
import { Client, createClient, GroupInfo, GroupMessageEvent, PrivateMessageEvent, segment, Sendable } from "oicq";
import { IFileEvent, IMessageEvent, IReceiveParams, IRemoteRoom, IRemoteUser, IRetList, ISendingUser, PuppetBridge } from "mx-puppet-bridge";

import * as sharp from "sharp";
import * as superagent from "superagent";
import * as yaml from "js-yaml";
import * as fs from "fs";
import { Controller } from "./control";

// import control from "./control";

const faceResizeOpt = 100;
export const consoleAvatar = "https://user-images.githubusercontent.com/39523898/101373495-f7bea780-38e7-11eb-9420-4b58ee599347.png";

/* Used to create identity from message or sth.*/
interface FriendIdentity
{
    user_id: number;
    nickname: string;
    card?: string;
    level?: number;
}

export const CONTROLLER_PARAMS =  {
    userId: "control",
    avatarUrl: _(consoleAvatar),
    name: _("Controller")
} as IRemoteUser;

interface IQPuppet
{
    client: Client;
    data: any;
    clientStopped: boolean;
}

interface IQPuppets
{
    [puppetId: number]: IQPuppet;
}

const isDirectAddr = (addr: string | number) => (typeof addr === "string" ) ? (addr.slice(-1) === "d") : isDirectAddr(Number(addr));
const cutAddr = (addr: string | number) =>  (typeof addr === "string" ) ? (isDirectAddr(addr) ? addr.slice(0, -1) : addr) : cutAddr(addr.toString());

async function callForBufferFromHTTP(url: string) {
    return superagent.get(url).buffer(true);
}

function buildAvatarUrl(id: number | string): string {
    return `https://q1.qlogo.cn/g?b=qq&s=100&nk=${id}`;
}

function buildGroupAvatarUrl(id: number | string): string {
    return `https://p.qlogo.cn/gh/${id}/${id}/100`;
}
1
async function autologin (qclient: Client, password: any): Promise<void> {
    qclient.on("system.login.qrcode", () => {
        process.stdin.once("data", () => {
            qclient.login();
        });
    });
    qclient.on("system.login.device", () => {
        qclient.logger.info(_("验证完成后敲击Enter继续.."));
        process.stdin.once("data", () => {
            qclient.login();
        });
    });

    return qclient.login(password);
}

export class App
{
    private client: Client;
    private puppets: IQPuppets = {};
    public groupCache: Map<number,number>;
    public groupCacheInitOK: boolean = false;
    private currenlyWorkingOn: number = 1;


    constructor(private puppet: PuppetBridge, private loginopt: Object, private controller: Controller)
    // constructor(private puppet, private loginopt)
    { this.groupCache = new Map(); }


    /* Due to the update from 1.x to 2.x of OICQ, validators are no longer in used. */

    /* Identifiy whether it is friend or not. */
    private isMyFriend = (id: number | string): boolean => (typeof(id) === "string") ? this.isMyFriend(Number(id)) : this.client.fl.has(id);

    /* Identifiy whether it is in a group or not. */
    private isInGroup = (id: number): boolean => (typeof(id) === "string") ? this.isInGroup(Number(id)) : this.groupCache.has(id);


    private async getUserNameById(userId: number): Promise<string>
    {
        if (this.isMyFriend(userId)) {
            // Just look up friend list if it's friend.
            return this.client.fl.get(userId).nickname;
        } else if (this.isInGroup(userId)) {
            // Look up details from group member info.
            const groupId = this.groupCache.get(userId);
            const memberInfo = await this.client.getGroupMemberInfo(groupId, userId);
            return memberInfo.nickname;
        } else {
            // If both invailed, directly look up QQ API.
            const cookie = this.client.cookies["qun.qq.com"];

            // Send request to WebApi.
            let response = await superagent
                .get(`https://cgi.find.qq.com/qqfind/buddy/search_v3?keyword=${userId}`)
                .set('Cookie', cookie);
            let data = JSON.parse(response.text);
            // Verify the output name.
	    try {
                return data.result.buddy.info_list[0].nick;
	    } catch {
		return _("Unknown Nickname");
	    }
        }
    }


    private async updateGroupCache()
    {
        console.log(_("Running group cache..."));
        // Go into groups...
        this.client.gl.forEach(group => {
            // Go into group's member lists...
            let count = this.groupCache.size;
            this.client.getGroupMemberList(group.group_id)
                .then(async (data) => {
                    // Process for each member.
                    data.forEach(element => {
                        this.groupCache.set(element.user_id, element.group_id);
                    });
                })
                .then(() => {
                    this.groupCacheInitOK = true;
                    console.log(_(`Approximately ${this.groupCache.size - count} entites were added to the cache!`));
                });
        });
    }


    public async getUserParams(puppetId: number, userId: number): Promise<IRemoteUser>
    {
        let userName: string;
        userName = await this.getUserNameById(userId);
	
        return {
            puppetId,
            userId: userId.toString(),
            avatarUrl: buildAvatarUrl(userId),
            name: userName
        } as IRemoteUser;
    }


    /*
     * This was *ONLY* provided for matix side involk! 
     */
    public async getbRoomParams(puppetId: number, chat: string): Promise<IRemoteRoom>
    {
        if (isDirectAddr(chat)) {
            // Get the ID of user.
            const id = cutAddr(chat);
            if (chat == "controld") {
                /* Special room for bride control. */
                return {
                    puppetId,
                    roomId: chat,
                    avatarUrl: _(consoleAvatar),
                    name: _("OICQ Puppet Bridge Control"),
                    topic: _("OICQ BRIDGE CONSOLE"),
                    isDirect: true
                }
            } else {
                // Return room info.
                return {
                    puppetId,
                    roomId: chat,
                    avatarUrl: buildAvatarUrl(id),
                    name: await this.getUserNameById(Number(id)),
                    topic: _("OICQ DIRECT CHAT"),
                    isDirect: true
                }
            }
        } else {
            // Get the  info of group.
            const info = await this.client.getGroupInfo(Number(chat));
            // Return room info.
            return {
                puppetId,
                roomId: chat,
                avatarUrl: buildGroupAvatarUrl(chat),
                name: info.group_name,
                topic: _("OICQ GROUP CHAT"),
                isDirect: false
            }
        }
    }


    /*
     * This was *ONLY* provided for oicq side involk! 
     */
    public async getqRoomParams(puppetId: number, chat: GroupInfo | FriendIdentity): Promise<IRemoteRoom>
    {
        if ("group_id" in chat && "group_name" in chat) {
            return {
                puppetId,
                roomId: `${chat.group_id}`,
                avatarUrl: buildGroupAvatarUrl(Number(chat.group_id)),
                name: chat.group_name,
                topic: _("OICQ GROUP CHAT"),
                isDirect: false
            };
        } else {
            return {
                puppetId,
                roomId: `${chat.user_id}d`,
                avatarUrl: buildAvatarUrl(Number(chat.user_id)),
                name: chat.nickname,
                topic: _("OICQ DIRECT CHAT"),
                isDirect: true
            }
        }
    }


    public async getSendParams(puppetId: number, msg: GroupMessageEvent | PrivateMessageEvent ): Promise<IReceiveParams | undefined>
    {
	switch (msg.message_type) {
            case "group":
                // If it was sent from a group...
                const info = await this.client.getGroupInfo(msg.group_id);
                return {
                    room: await this.getqRoomParams(puppetId, info),
                    user: await this.getUserParams(puppetId, msg.sender.user_id),
                    eventId: msg.message_id
                }
            case "private":
                // If it was sent face to face...
                return {
                    room: await this.getqRoomParams(puppetId, msg.sender),
                    user: await this.getUserParams(puppetId, msg.sender.user_id),
                    eventId: msg.message_id
                }
        }
    }


    /* Return a direct chat roomid with 'd' in the end. */
    public getDmRoom = async (remoteUser: IRemoteUser) => `${remoteUser.userId}d`;
    /* Create a new room for bridging. */
    public createRoom = async (room: IRemoteRoom) => await this.getbRoomParams(room.puppetId, room.roomId);
    /* Create a new user for bridging. */
    public createUser = async (remoteUser: IRemoteUser) => {
        if (remoteUser.userId == "control") {
	    let params = CONTROLLER_PARAMS;
	    params.puppetId = remoteUser.puppetId;
            return params;
        } else {
            return await this.getUserParams(remoteUser.puppetId, Number(remoteUser.userId));
        }
    };
    /* Not implied */
    public removePuppet = async (puppetId: number) => delete this.puppets[puppetId];
    public deletePuppet = async (_: number) => this.removePuppet(_);
    
    /* Only support one client at the same time... */
    public async newPuppet(puppetId: number, data: any)
    {
        if (this.puppets[puppetId]) {
            await this.removePuppet(puppetId);
        }
        this.puppets[puppetId] = {
            client: this.client,
            data,
            clientStopped: false
        }
    };


    public async listUsers(_: number): Promise<IRetList[]> {
        const reply: IRetList[] = [];
        this.client.fl.forEach((e) => {
            reply.push({
                id: e.user_id.toString(),
                name: e.nickname
            });
        });
        return reply;
    }


    public async listRooms(_: number): Promise<IRetList[]> {
        const reply: IRetList[] = [];
        this.client.gl.forEach((e) => {
            reply.push({
                id: `${e.group_id}`,
                name: e.group_name
            });
        });
        return reply;
    }


    public async getUserIdsInRoom(room: IRemoteRoom): Promise<Set<string> | null>
    {
        const users = new Set<string>();
        if (isDirectAddr(room.roomId)) {
            users.add(cutAddr(room.roomId).toString());
        } else {
            const members = await this.client.getGroupMemberList(Number(cutAddr(room.roomId)));
            members.forEach((e) => { users.add(e.user_id.toString()); });
        }
        return users;
    }


    /* Handle the message from OICQ lib. */
    private async incomeOICQ (event: GroupMessageEvent | PrivateMessageEvent)
    {
        // Know where to send.
        const params = await this.getSendParams(this.currenlyWorkingOn, event);
        if (params === undefined) { console.log(_("An error occured while parse OICQ data!")); }

        let opts: IMessageEvent;
        let name = _("[未知文件]");
	let sendFileReq = false;
	// This is reserved for face&text convention.
	let content = "";
	let sendTextReq = false;

        event.message.forEach(async (msg) => {
	    switch (msg.type) {
		case "face":
		    msg.text = `[${msg.text}]`
                case "text":
		    sendTextReq = true;
                    // Bug fix for OICQ issue #259.
		    if (msg.text !== "你的QQ暂不支持查看视频短片，请期待后续版本。") {
			content += msg.text.trim()
		    }
		    break;
                case "xml":
                    // Only support location parsing.
                    if (msg.data.includes("[位置]") && msg.data !== null) {
                        const lat = msg.data.match("lat=(.*?)&amp");
                        const lng = msg.data.match("lon=(.*?)&amp");
                        const loc = msg.data.match("loc=(.*?)&amp");
                        if (lat === null || lng === null || loc === null) { break; }
                        if (lat[1] === null || lng[1] === null || loc[1] === null) { break; }
                        opts = { body: `位置分享（${loc[1]}）\n经度 ${lng[1]} 纬度 ${lat[1]}`, eventId: event.message_id };
                        this.puppet.sendMessage(params, opts);
                    }
                    break;
                case "file":
                    name = msg.name;
		    sendFileReq = true;
		    break;
		case "image":
		    name = "[QQ表情]"
                    if ("url" in msg) {
			callForBufferFromHTTP(msg.url).then(async (data) => {
			    if (msg.asface === true) {
				sharp(data.body)
				    .resize(faceResizeOpt)
				    .toBuffer()
				    .then((pic: Buffer) => this.puppet.sendFileDetect(params, pic, name))
				    .catch((err: string) => console.log(err));
			    } else {
				name = "[QQ图片]";
				this.puppet.sendFileDetect(params, data.body, name);
			    }
			});
		    }
		    sendFileReq = false;
		    break;
		case "flash":
                    name = "[QQ闪照]";
		    sendFileReq = true;
		    break;
                case "video":
                    name = "[QQ视频]";
		    const videoUrl = await this.client.getVideoUrl(msg.fid, msg.md5)
		    callForBufferFromHTTP(videoUrl)
			    .then((data) => this.puppet.sendFileDetect(params, data.body, name));
		    sendFileReq = true;
		    break;
	    }
	    
	    if ("url" in msg && sendFileReq) {
		callForBufferFromHTTP(msg.url).then((data) => {
                    this.puppet.sendFileDetect(params, data.body, name);
		});
	    }
	});
	
	if (sendTextReq) {
	    opts = { body: content, eventId: event.message_id };
	    this.puppet.sendMessage(params, opts);
	}
    }


    /* Handle the message from matrix. */
    public async incomeBridge (type: string, room: IRemoteRoom, msg: any)
    {
        let content: Sendable, method: string;

        if (cutAddr(room.roomId) === "control") {
            this.controller.handle(msg.body, room);
        }

        if (isDirectAddr(room.roomId)) {
            if (this.isMyFriend(cutAddr(room.roomId))) {
                // Send as a friend message.
                method = "friend";
            } else if (this.isInGroup(cutAddr(room.roomId))) {
                // Send as a temp message.
                method = "temp";
            }
        } else if (!isDirectAddr(room.roomId)) {
            method = "group";
        }
	
        // Build oicq message from matrix message.
        switch (type) {
            case "text":
                content = msg.body;
                break;
            case "image":
                content = segment.image(msg.url);
                break;
	    case "sticker":
		/* Will come to use, if OICQ has an option to send image asface */
	    case "video":
		/* Videos should be downloaded locally after sending it. */
		// content = segment.video(msg.url);
                break;
            case "audio":
                content = segment.record(msg.url);
                break;
	    case "location":
		/* As this hasn't impliied by mx-puppet-bridge, we will leave it here. */
		// content = segment.location(msg.lat, msg.lng, msg.addr);
		break;
	}

        // Send oicq message by some ways.
        switch (method) {
            case "friend":
                return this.client.sendPrivateMsg(cutAddr(room.roomId), content);
            case "temp":
                return this.client.sendTempMsg(
                    this.groupCache.get(cutAddr(room.roomId)),
                    cutAddr(room.roomId),
                    content
                );
            case "group":
                return this.client.sendGroupMsg(Number(room.roomId), content);
        }
    }


    public async handleMatrixMessage(room: IRemoteRoom, data: IMessageEvent, _: ISendingUser | null, __: any) {
        this.incomeBridge("text", room, data);
    }

    public async handleMatrixImage(room: IRemoteRoom, data: IFileEvent, _: ISendingUser | null, __: any) {
        this.incomeBridge("image", room, data);
    }

    public async handleMatrixVideo(room: IRemoteRoom, data: IFileEvent, _: ISendingUser | null, __: any) {
        this.incomeBridge("video", room, data);
    }

    public async handleMatrixAudio(room: IRemoteRoom, data: IFileEvent, _: ISendingUser | null, __: any) {
        this.incomeBridge("audio", room, data);
    }

    public async init(cfgFile: string): Promise<void>
    {
        // Read login configuration.
        let cfg: ConfigWrap = new ConfigWrap();
        cfg.applyConfig(yaml.load(fs.readFileSync(cfgFile).toString()));
        // Log into our account.
        this.client = createClient(cfg.login.id, this.loginopt);
        autologin(this.client, cfg.login.pass);

        this.client.on("system.online", async () => {
            this.updateGroupCache();
	    this.controller.installPuppet(this.puppet);
	    this.controller.installClient(this.client);
	    this.controller.initInstance();
        });

        this.client.on("message.group", data => { this.incomeOICQ(data) });
        this.client.on("message.private", data => { this.incomeOICQ(data) });
    }
}

