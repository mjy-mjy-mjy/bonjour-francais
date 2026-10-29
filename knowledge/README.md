# 技能索引维护

`skills.json` 是语义技能的手工源，`skill-tree-data.js` 是生成文件，不要分别修改两份。运行 `python3 scripts/build-course.py` 同时生成课程、技能数据和引用指纹。

每个已实现技能需要：稳定ID、分支、阶段、标题、目标、至少两项掌握标准、指向现有讲义的 `refs` 和建议基础 `requires`。语法的 `group` 使用 `verbs`、`nominals` 或 `structure`。同一语义技能跨课只维护一个节点；规则与例句保留在原讲义。

规划节点用 `planned:true`，当前仅列学习方向，不含可点亮状态、不计入已实现技能分母。转成正式节点前补齐内容引用和标准，并核对范围与教学阶段。

扩展后运行 `node --test scripts/*.test.cjs`。测试覆盖唯一ID、来源章节、无循环依赖、布局边界、备份、掌握与复测时间、搜索和路由。变更首批范围时有意识地更新覆盖断言，并同步页面范围说明与文档；不能为了通过检查而删除覆盖测试。

`skillMastery` 中的个人记录以语义ID保存，包含 `level`、`updatedAt`、可选 `masteredAt`、`reviewedAt` 和 `note`。避免改名或复用已有ID表达不同知识。课程完成、章节自评和技能自评分别保留；没有证据时不相互推断为已掌握。
