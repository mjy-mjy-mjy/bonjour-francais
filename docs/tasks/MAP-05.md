# MAP-05：地图可读性与桌面布局

2026-10-30（北京时间）；窗口本会话，分支work，基线215366d。用户授权按三轮顺序实现。

完成标签按屏幕像素检查碰撞，优先保留选择及当前课；课程状态具备文字、符号与颜色。宽屏面板360—600px自适应，保留原底图。第6单元路线为默认关闭的可开关样板，未经真实视觉验收，未推广。

回归127项Node通过；构建、内容与9份JS语法通过。自动覆盖1280—3840 CSS宽度及多种缩放的标签冲突和样板开关。真实2K／4K浏览器、系统125%／150%缩放与手机视觉未运行：当前无浏览器控制工具。像素模型不等于实际排版截图。

保留课程、笔记及自评格式；下一轮MAP-06。

收尾自审修正[7ab4304](https://github.com/mjy-mjy-mjy/bonjour-francais/commit/7ab430430dfbfbd01fec66f19d875d7bd342cfd8)：返回单元时重绘清除旧课选择；标签样式覆盖旧的低缩放隐藏规则。131项Node再次通过，[最终Pages工作流](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41013982928)完成且success。未经真实视觉验收，不将路线样板推广至其他单元。

提交[6091bb8](https://github.com/mjy-mjy-mjy/bonjour-francais/commit/6091bb822dbbbe7dc567404a173d189127f908f9)已推送并核对，[Pages工作流](https://github.com/mjy-mjy-mjy/bonjour-francais/actions/runs/41013293203)完成且success。线上页面效果／产物哈希未验。
