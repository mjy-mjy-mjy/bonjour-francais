# Bonjour Français · 你好法语

网站 / 博客链接：[https://mjy-mjy-mjy.github.io/bonjour-francais/](https://mjy-mjy-mjy.github.io/bonjour-francais/)

面向中文母语者的法语自学网站，以《Le Nouveau Taxi! 1 / 你好！法语》A1 教材的学习顺序为起点，逐步补充听、说、读、写训练，围绕 NCLC 7 目标扩展学习路线。

## 第一版功能

- 按路线学习：课程目标、中文讲解、词汇、例句、练习与解析。
- 动态首页：记住最近打开的未完成课次；标记完成后推荐下一课，也可手动选择当前学习课次。
- 扁平分类：发音、词汇、语法、听力、口语、阅读与写作。
- 个人复习：学习进度、收藏、错题和笔记，保存在浏览器，支持导出与导入。
- 官方资源：NCLC 标准、加拿大 Express Entry 与语言成绩对照。
- EE 邀请记录：轮次编号、类别、官方日期时间、最低获邀 CRS 分数、邀请数量、同分排序规则及官方来源。

## 首页如何继续学习

第一次访问可从第1课开始，也可在首页“当前学习课次”选择你实际学到的课程。打开未完成课程或其技能页会记住课次；只打开课程不会标记完成。标记完成后推荐后续未完成课次，回看已完成课程不会替换当前课次。撤销完成会将该课恢复为当前课次。

首页标题、课程入口、课次高亮和默认技能入口随进度变化。第16课及以后的讲义尚未补充时，首页会明确显示“教材笔记”；技能入口指向就近已提供讲义的课程。记录仅保存在当前浏览器，旧备份仍可导入；旧记录没有当前课次时，根据已完成课次推荐，也可手动调整。

## 实现方向

无第三方前端依赖的静态网站，可通过 GitHub Pages 发布。课程与公开邀请数据独立维护；个人学习记录不上传仓库。GitHub Actions 在更新代码、手动触发或定时运行时检查官方邀请记录，展示最近成功检查时间；抓取或校验失败时保留已有记录。定时任务计划在北京时间每天 10:17 运行，GitHub 可能延迟或暂停长期未活动仓库的定时任务。

## 在电脑上预览

在项目目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

在浏览器打开 `http://127.0.0.1:8765`。请使用本地服务器预览，避免直接打开 HTML 时浏览器阻止邀请数据读取。

## 发布到 GitHub Pages

使用 GitHub Free 时，将仓库设为 Public。在 Settings → Pages 中选择 GitHub Actions 作为发布来源，然后手动运行 “Update official records and publish website” 工作流。完成后从 Pages 设置或工作流结果取得网址。

工作流只发布 `index.html`、样式、课程脚本及 `data/` 中的公开数据，不发布个人备份文件。

## 更新与检查

```sh
python3 scripts/update-draws.py
python3 scripts/build-course.py
python3 scripts/check-site.py
node --check app.js
node --check content.js
node --check lesson14.js
node --check course.js
node --test scripts/app.test.cjs
```

邀请数据来自 IRCC 公开 JSON，保存官方原始类别、时间和详情链接。91a、91b 等历史轮次编号按官方原样保留。调整 `content.js` 可维护基础题目和资源链接；`lesson14.js` 是第 14 课详细讲义、书面练习和新增即时小测的统一内容来源，分类页引用同一份内容。

## 官方资源

- [NCLC 标准与资源](https://www.language.ca/ressourcesexpertise/niveaux-de-competence-linguistique-canadiens/)
- [加拿大 Express Entry](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html)
- [EE 邀请轮次](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html)
- [语言考试成绩与 NCLC 对照](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html)

## 内容维护

公开课程采用原创讲解、例句与练习，教材及配套素材通过获授权来源引用。邀请记录保留官方链接和原始时间，并按类别展示。

## 课程内容标准

每个正式课程页应提供：学习目标；完整变位或结构表；中文讲解与法语例句；词汇的词性、阴阳性及搭配；相似表达辨析；语音；易错点；覆盖知识点的练习和解析；听说读写输出任务；复习清单。区分教材核心、复习与拓展，不把占位笔记页标为课程已完成。已有 q1—q6 题目 ID 保留以兼容学习备份。

## 当前状态

第 **1—15课均已提供详细讲义**。每课包含12个知识模块、10组书面练习与参考解析、30道可自动判分并记录错题的小测，并提供词汇、发音、阅读、口语和写作任务。支持知识点搜索、分类页按课次学习、目录定位、展开参考答案与A4打印（含答案）。

最新补充：

- [第13课 Un aller simple · 一张单程票](https://mjy-mjy-mjy.github.io/bonjour-francais/#lesson/13)：钟点与日期、partir完整变位、quand/quelle提问、礼貌购票、时刻表与票面阅读、数字读音及/s/与/z/。68项书面练习、30道小测。
- [第15课 Le dimanche matin · 星期日早晨](https://mjy-mjy-mjy.github.io/bonjour-francais/#lesson/15)：lire/écrire完整变位、代词式动词、faire de/jouer à与运动、正在进行的活动及日常习惯、法语r音。70项书面练习、30道小测。

两课共138项书面练习、60道小测，均附解析；教材核心、复习和补充表达分别标注，本站阅读资料与练习为原创。第1—12课及第14课内容已保留，路线目录扩展至第15课。每课先核对内容与功能，再开始下一课；40项自动功能测试通过，并核对浏览器中的答案展开、判分与错题保存。

第16课及以后的详细内容尚待编写，提供教材学习记录与笔记入口；目录中的课题或课次入口不代表正文已经完成。A2及中级、考试专项内容将在后续扩充。

教材配套音频通过出版方资源页访问；本站尚未集成音轨播放器、自动口语或写作评分。

第1—13课及第15课的内容源放在 `lessons/NN.json`，目录放在 `lessons/catalog.json`。运行 `scripts/build-course.py` 生成 `course.js`；不要直接编辑生成文件。每课完成后保存知识覆盖与功能核对记录，再开始下一课。
