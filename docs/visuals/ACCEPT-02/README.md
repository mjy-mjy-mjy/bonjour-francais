# ACCEPT-02：线上核对与跨课自动回归证据

2026-10-30（北京时间），基线328543f。本轮没有浏览器控制接口和用户设备连接；没有运行新的实际浏览器交互、截图、CSS视口／DPR矩阵或系统／浏览器缩放验证。不借用ACCEPT-01截图充当本轮结果。

## 版本与线上

开工`git fetch origin`成功，work HEAD与origin/main均为`328543f3f81f12d22e2e21352763e8a075a5b633`；GitHub连接器独立核对main ref一致。未提交内容只有已有work/，没有覆盖或提交它。

- [基线Pages工作流41018875876](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41018875876)：对应328543f，检查、公开文件准备、上传和部署步骤均completed/success。
- 实际站点`https://mjy-mjy-mjy.github.io/bonjour-francais/`：使用继承代理执行curl HEAD，CONNECT返回403、curl退出56，未取得HTML或资源响应。限制发生在连接隧道，不能据此判断网站自身返回403或站点故障。
- GitHub API报告该次`github-pages`产物ID 12960403916，ZIP大小1070845字节，未过期；报告digest为`sha256:6a7e7f4a574b16cc7e96bc800f1edfea9b985f0726dbe6581736227c80bb538c`。下载连接器返回文件引用，但文件下载地址同样遭CONNECT 403；未读取ZIP字节或将其与源码比对。API给出的digest仅作元数据记录，不称为本地复算通过。
- 没有绕过代理、改网络策略或改域名来访问被阻止的站点。

## 构建、指纹与HTTP子路径

仅评审，使用`git archive HEAD`在work/acceptance-02/review-copy创建临时副本，运行构建和内容检查。index.html、course.js、lesson14.js、skill-tree-data.js、verb-data.js、grammar-data.js共6份文件重建前后逐字节一致；工作区生成文件未改写。

[check-public-assets.py](../../../scripts/check-public-assets.py)从HTML读取脚本／样式引用，以SHA-256前12位核对`?v=`，再检查实际HTTP响应字节。当前14个引用均为相对子路径且指纹匹配；临时站点的`/bonjour-francais/`下检查HTML、14项脚本／样式及地图底图，16个响应均200且与临时副本一致。[结果与哈希清单](assets.json)明确记录为本地HTTP核验；不代表线上CDN、实际发布ZIP或浏览器请求已通过。

本地复现命令（先将已构建的临时副本置于服务器目录的bonjour-francais/下）：

```sh
python3 scripts/check-public-assets.py --root work/acceptance-02/review-copy --base http://127.0.0.1:8872/bonjour-francais/ --out work/acceptance-02/local-assets.json
```

HTTP层的片段路由不会发到服务器；本轮验证了入口和资源子路径，以及Node中的深路由初始化／切换。浏览器直接打开深链接、原生刷新、后退／前进和资源面板实测仍未运行。

## 跨课自动回归

[cross-lesson.test.cjs](../../../scripts/cross-lesson.test.cjs)在隔离内存localStorage/sessionStorage中共同加载应用、地图、技能树、共享变位和语法实现，通过合成DOM事件检查真实实现的状态传递。它不是浏览器，也不验证命中区域、布局、字体、实际滚动边界或浏览器原生历史。

| 课程 | 选择的知识点 | 实际共享范围 |
| --- | --- | --- |
| 14 · À Londres | 常用不规则现在时 g-irregular；verbs、practice | 本课4条共享现在时可查；技能显示已有共享变位速查，无该技能的语法试点正文 |
| 20 · Les fêtes | dernier与过去时间 g-dernier；dernier、practice | 未迁移此主题的共享正文，标准和原讲义入口可查 |
| 21 · C’est interdit ! | 命令式与间接宾语代词 g-coi-imperative；coi、practice | 未迁移此主题的共享正文，保留原讲义与已有练习 |

每课自动检查：

1. 定位课程，打开本课图鉴；单元＋课次＋语法＋关键词组合、技能标准和实际课程／practice引用。
2. 初始化及切换技能深路由；列表／详情缓存往返；讲义答案展开和深阅读缓存；重新创建隔离会话模拟刷新恢复。数字滚动位置为DOM模型赋值，不是实际排版像素结论。
3. 通过原提交处理器作答现有小测、保存合成笔记；技能自评后列表文字及统计更新；返回图鉴保留关键词／课次与面板位置。
4. 单独标记课程完成、写章节自评，确认技能自评不被改写；原笔记与小测记录保留；清除图鉴条件不清学习记录。

第4项独立用例另外核对第20课关联g-agreement、第21课关联g-negative所展示的共享语法仍只来自前16课试点，没有将本课讲义宣称已迁移。

`node scripts/cross-lesson.test.cjs`共4项通过；连同既有套件，本轮逐文件执行Node共148项（应用93、跨课4、地图23、技能22、变位6），0失败／跳过。临时副本构建、check-site、根目录10份JS语法检查、新脚本语法检查及4项Python构建单测通过。既有浏览器脚本只审查，未重新运行其11组视口。

## 桌面缺口与结论

本轮没有可记录的实际浏览器型号、物理屏幕分辨率、真实CSS有效视口或系统／浏览器缩放。静态审查确认宽屏面板、标签优先级和独立滚动代码仍在；不能由此断言新桌面视觉验收通过。

没有复现新的应用问题，未改应用JS／CSS、课程、知识源、ID、学习判断、备份协议及资源指纹。只补验证脚本和记录。现有ACCEPT-01浏览器证据加本轮跨课自动回归支持继续正常学习；线上页面／资源字节、真实常用设备缩放和原生浏览器往返仍是明确未验项。未发现具体内容缺口，不提出K2或第22课建设任务。
