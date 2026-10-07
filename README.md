# Bonjour Français · 你好法语

面向中文母语者的法语自学网站，以《Le Nouveau Taxi! 1 / 你好！法语》A1 教材的学习顺序为起点，逐步补充听、说、读、写训练，围绕 NCLC 7 目标扩展学习路线。

## 第一版功能

- 按路线学习：课程目标、中文讲解、词汇、例句、练习与解析。
- 扁平分类：发音、词汇、语法、听力、口语、阅读与写作。
- 个人复习：学习进度、收藏、错题和笔记，保存在浏览器，支持导出与导入。
- 官方资源：NCLC 标准、加拿大 Express Entry 与语言成绩对照。
- EE 邀请记录：轮次编号、类别、官方日期时间、最低获邀 CRS 分数、邀请数量、同分排序规则及官方来源。

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
python3 scripts/check-site.py
node --check app.js
node --check content.js
node --test scripts/app.test.cjs
```

邀请数据来自 IRCC 公开 JSON，保存官方原始类别、时间和详情链接。91a、91b 等历史轮次编号按官方原样保留。调整 `content.js` 可维护原创词汇、题目和资源链接。

## 官方资源

- [NCLC 标准与资源](https://www.language.ca/ressourcesexpertise/niveaux-de-competence-linguistique-canadiens/)
- [加拿大 Express Entry](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html)
- [EE 邀请轮次](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html)
- [语言考试成绩与 NCLC 对照](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html)

## 内容维护

公开课程采用原创讲解、例句与练习，教材及配套素材通过获授权来源引用。邀请记录保留官方链接和原始时间，并按类别展示。

## 当前状态

第一版以第 14 课 **À Londres** 为首个补充课程，包含 6 道练习与中文解析。其他课次提供教材学习记录与笔记入口。A2 及中级、考试专项内容将在后续扩充。

教材配套音频通过出版方资源页访问；本站尚未集成音轨播放器、自动口语或写作评分。
