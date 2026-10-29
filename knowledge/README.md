# 技能索引维护

`skills.json` 是语义技能的手工源，`skill-tree-data.js` 是生成文件，不要分别修改两份。运行 `python3 scripts/build-course.py` 同时生成课程、技能数据和引用指纹。

每个已实现技能需要：稳定ID、分支、阶段、标题、目标、至少两项掌握标准、指向现有讲义的 `refs` 和建议基础 `requires`。语法的 `group` 使用 `verbs`、`nominals` 或 `structure`。同一语义技能跨课只维护一个节点；规则与例句保留在原讲义。

规划节点用 `planned:true`，当前仅列学习方向，不含可点亮状态、不计入已实现技能分母。转成正式节点前补齐内容引用和标准，并核对范围与教学阶段。

扩展后运行 `node --test scripts/*.test.cjs`。测试覆盖唯一ID、来源章节、无循环依赖、布局边界、备份、掌握与复测时间、搜索和路由。变更首批范围时有意识地更新覆盖断言，并同步页面范围说明与文档；不能为了通过检查而删除覆盖测试。

`skillMastery` 中的个人记录以语义ID保存，包含 `level`、`updatedAt`、可选 `masteredAt`、`reviewedAt` 和 `note`。避免改名或复用已有ID表达不同知识。课程完成、章节自评和技能自评分别保留；没有证据时不相互推断为已掌握。

## 动词共享知识（K1）

`verbs.json` 是第1—16课已提供完整六人称的直陈式现在时源，范围及未收录项见 [动词盘点](../docs/VERB_INVENTORY_A1_U1_U4.md)。普通形式与代词式分别维护，例如 `present-appeler` 与 `present-s-appeler`，通过 `relatedIds` 对照。当前记录不表示全部法语动词或全部A1知识。

每条记录包含：稳定ID、原形、含义、教材／阶段／语式／时态、组别、`pronominal`、六个人称的 `forms`、`jeElision`、变化与用法提示、原创例句、`skillIds`、来源和核对状态。`forms` 不含主语，但代词式保留me／te／se／nous／vous／se；第一人称省音由显式 `jeElision` 决定，不能仅凭h字母推定哑音。保留主语on的第三人称规则。

`refs` 是完整展示的绑定位置：课次、原章节、教学角色与表格定位信息。单数核心／复数拓展等差异可用 `roleNote` 注明；`firstLesson` 表示首次完整变位，不等于某个词首次偶然出现。没有完整表的识别词不加入“截至某课的完整表”覆盖统计。

课程作者HTML用 `{{verb:present-faire:3}}` 等占位符引用共享形式，索引0—5对应je、tu、il/elle/on、nous、vous、ils/elles。课程语境、例句、练习、原章节ID和既有排版留在课程中；不要把已共享的变位再手填回作者表格。原表保留主语和解释，占位符只代替词形。

`python3 scripts/build-course.py` 验证引用，将同一数据编入课程与 `verb-data.js`，并生成兼容 `lesson14.js` 别名和缓存指纹。浏览器 `verb-knowledge.js` 提供查阅／技能内嵌表，完整知识规则正文的其他部分仍未全量迁移。新增资源必须进入Pages文件清单。

第14课现在从 `lessons/14.json` 维护，`lesson14.js` 不再是手工源。其12章节、q7—q30以及 `content.js` 的q1—q6和原笔记键保留；兼容别名仍可供现有模块使用。

修改后运行构建、`python3 scripts/check-site.py`、`python3 scripts/test_verb_build.py` 和全部 `scripts/*.test.cjs`；确认实际用例执行。可选浏览器检查为 `python3 scripts/check-verb-library.py`，需Playwright、Chromium及本地8765服务器。旧结构／题目选项兼容基线在 `scripts/fixtures/k1-legacy-signatures.json`；不要为通过测试静默改写旧题含义。
