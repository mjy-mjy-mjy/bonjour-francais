# TREE-02：首批语法共享与关系导航

2026-10-30（北京时间）；work，本会话；基线e1d43f8。按[francais-review-unit](../../.agents/skills/francais-review-unit/SKILL.md)执行用户明确授权的首批模块。范围：第1—16课冠词、性数配合、现在时否定；[逐课候选与处理](../GRAMMAR_PILOT_INVENTORY.md)。

3条共享记录、6个原文块（2/articles、2/gender、3/articles、5/plural、6/negative、6/agreement）从原课迁至knowledge/grammar.json，原章用占位符绑定。构建展开后的course.js无变化；原ID、题目、笔记、教学分层及例外完整保留。规则摘要、例句、易错点与原文同源展示；其他语法和混合专题仍保留原课，不声称K2全部完成。

详情显示跨分支的建议基础与后续名称，跳转时解除原范围限制，保存原视图并可返回。99条requires语义未改变，不把建议基础当父子分类。新增grammar-data.js生成资源已加入指纹、加载顺序和Pages清单。构建新增绑定完整性验证。

135项Node通过（91／21／17／6），4项Python（共享语法2＋原动词2）通过；构建、内容、10份JS语法、diff检查通过。精确比较共享原文与编译课程，既有20课签名兼容测试通过；新增跨分支挂载往返测试。语言摘要据已存在讲义逐项核对，未声称出版方新认证。真实浏览器视觉未验。

提交[4402552](https://github.com/mjy-mjy-mjy/bonjour-francais/commit/44025525474dc3e68dd475ac1a225febef71c846)已推送main并核对本地树一致；[Pages部署](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41015095484)完成且success。线上产物哈希及页面视觉未核验。
