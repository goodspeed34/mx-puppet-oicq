/* Define a set of extra configuration classes. */

export class ConfigWrap
{
    public bridge: BridgeInfo;
    
    public login: LoginInfo;

    public control: ControlInfo;

    public provisioning: ProvisionInfo;

    public database: DatabaseInfo;

    public applyConfig(newConfig: {[key: string]: any}, configLayer: {[key: string]: any} = this) {
		Object.keys(newConfig).forEach((key) => {
			if (configLayer[key] instanceof Object && !(configLayer[key] instanceof Array)) {
				this.applyConfig(newConfig[key], configLayer[key]);
			} else {
				configLayer[key] = newConfig[key];
			}
		});
	}
}

export class BridgeInfo
{
    public port: number;
    public bindAddress: string;
    public domain: string;
    public homeserverUrl: string;
    public firstInit: boolean;
}

export class DatabaseInfo
{
    public filename: string;
}

export class ProvisionInfo
{
    public whitelist: Array<String>;
}

export class LoginInfo
{
    public id: number;
    public pass: any;
}

export class ControlInfo
{
    public user: string;
}
