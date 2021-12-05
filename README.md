<p align="center" xmlns:dct="http://purl.org/dc/terms/" xmlns:vcard="http://www.w3.org/2001/vcard-rdf/3.0#">
  <a rel="license"
     href="http://creativecommons.org/publicdomain/zero/1.0/">
    <img src="http://i.creativecommons.org/p/zero/1.0/88x31.png" style="border-style: none;" alt="CC0" />
  </a>
  <br />
  To the extent possible under law,
  <a rel="dct:publisher"
     href="goodspeed.noblogs.org">
    <span property="dct:title">Nios34</span></a>
  has waived all copyright and related or neighboring rights to
  <span property="dct:title">mx-puppet-oicq</span>.<br/>
This work is published from:
<span property="vcard:Country" datatype="dct:ISO3166"
      content="CN" about="https://goodspeed.noblogs.org">
  China Mainland</span>.
</p>

----

# mx-puppet-oicq

mx-pupept-oicq 是轻量级的 QQ 到 Matrix 网络的网桥实现。网桥使用 nodejs 开发，使用 mx-puppet-bridge 与 OICQ 作为运行库。

## 食用方法

首先，下载依赖库：

```
$ git clone https://github.com/goodspeed34/mx-puppet-oicq.git

$ cd mx-puppet-oicq

$ make all
```

然后简单地配置：

```
$ make mgen
```

你会看到一连串互动性问答，回答正确信息即可。

然后，你就可以看到一个 oicq-registration.yaml 文件，将它复制到 synapse 主机上。

修改 Homeserver 的配置文件（通常为 homeserver.yaml），加入下面的内容：

```yaml
app_service_config_files:
  - /path/to/oicq-registration.yaml
```

完成后就可以输入 make run 然后开始使用了！
