# ACCEPT-02：线上与常用桌面验收、跨课回归

- 更新：2026-10-30（北京时间）；来源：用户本轮明确要求。
- 状态：本轮可执行验证、推送及Pages部署已核对；线上／真实设备仍未验；窗口：本会话；分支：work；基线328543f，远端main一致（shell fetch与连接器已核对）。
- 范围：线上版本／发布产物核对、桌面验证缺口、第14／20／21课回归、必要的小范围修复与测试、进度和证据。保留稳定ID、旧路由、笔记及备份，不扩大共享语法、不领取K2／第22课或手机专项。
- 开工：无已跟踪文件未提交改动；既有work/临时材料完整保留，新临时材料使用work/acceptance-02/，不整体提交work/。

## 执行记录

1. 已读AGENTS、PROGRESS、ACCEPT-01任务与视觉证据、验收脚本及相关实现。
2. 当前工具目录未提供Browser app的js接口，也没有CUA云浏览器接口；没有用户常用设备可访问。遵守[浏览器技能](skill://plugin_connector_1p_51c1ba70f47481919149861084681943/control-browser/SKILL.md)的“Use only the associated Browser app's `js` tool to control this browser.”约束，不以shell启动替代浏览器。本轮不把Node事件模拟、静态布局审查或上轮截图称为新浏览器验收。已有Playwright脚本仅审查，浏览器执行暂未运行。
3. 328543f对应[Pages工作流41018875876](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41018875876)检查／上传／部署success。实际线上curl经当前代理CONNECT 403，未取得HTML；GitHub产物下载连接器返回文件引用，但下载地址同样受403限制，ZIP内容未比对。
4. 临时副本构建及内容检查通过；6份生成文件逐字节不变，14项脚本／样式指纹正确；本机Pages子路径16项HTTP响应均200并与临时副本字节一致。这是本地发布源核验，不是线上或实际发布ZIP核验。

## 问题清单

本轮未复现新的应用缺陷，不为产生应用提交而改JS／CSS或内容。环境限制：线上域名及产物文件下载连接被代理403拒绝；无受支持的浏览器控制接口或真实用户设备。两项均已明确记录，不标记为站点故障。

## 验证与交付

2026-10-30（北京时间）：

- 新增`node scripts/cross-lesson.test.cjs`4项集成事件回归：第14课g-irregular及4条已有共享现在时、第20课g-dernier、第21课g-coi-imperative，以及有限共享语法范围。三课检查定位／组合筛选、技能标准／真实出处、讲义练习、自评、列表统计和跨页／重建会话缓存恢复。各项合成写入均在独立内存存储，不载入私人备份。
- 应用93／跨课4／地图23／技能22／变位6，共148项Node逐文件执行通过，0失败／跳过；临时副本构建、check-site、4项Python构建单测通过。根目录10份JS与新增脚本语法检查通过。
- 新增`scripts/check-public-assets.py`支持在网络可用时将目标HTTP资源与指定的发布源逐字节核对；本轮仅运行本地HTTP检查。线上HEAD已明确拒绝后未重复对线上各资源发起请求。
- 实际浏览器、原生后退／前进／刷新、桌面命中区域／字体／标签视觉、系统和浏览器缩放均未运行；未将Node事件模型当成实际浏览器。没有重跑ACCEPT-01的11组视口，也未开展手机专项。
- 自审：没有应用代码、数据源、生成文件、发布清单或学习协议变化；新增Node套件已被现有Pages的`scripts/*.test.cjs`通配检查覆盖。新增验证脚本不属于公开站点资源，无需加入发布清单。
- 详细复现与证据见[ACCEPT-02验证记录](../visuals/ACCEPT-02/README.md)及[本地资源哈希清单](../visuals/ACCEPT-02/assets.json)。文档链接与`git diff --check`通过；本轮提交及部署见下；部署成功不能等同线上实测。

## 收敛结论

既有ACCEPT-01浏览器验收与本轮跨课自动回归支持进入正常学习使用期。线上资源字节、真实常用设备系统缩放和浏览器原生历史仍未验，可能存在CDN缓存／设备排版差异；当前证据不能排除这些问题。未发现具体内容缺口，不追加K2整理、第22课或新功能任务。


## 提交与部署

验证脚本及记录提交[796eb72](https://github.com/mjy-mjy-mjy/bonjour-francais/commit/796eb7204fa5febc715f1892c19facd6bea30b69)已正常推送main，连接器核对远端SHA一致。[Pages工作流41021245112](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41021245112)已completed/success；检查、公开文件准备、上传及部署步骤均success。应用与公开站点资源未改，线上页面及资源字节仍未实测。工作区仅保留未提交work/材料。
