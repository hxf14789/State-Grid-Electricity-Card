# 国家电网电费卡片

多户号电费概览 + 每日用电柱状图。

> ⚠️ **前置条件**：必须先安装 [国家电网 Home Assistant 集成](https://github.com/stevenjoezhang/hass-state-grid)，本卡片只负责展示，不获取数据。

- 户号胶囊切换，概览与图表联动
- 年 / 月 / 日 视图、阶梯电量红线
- 每日用电柱状图，点柱子看当天用电、电费与尖峰平谷拆分
- 深浅色自动跟随主题

![预览](images/preview.png)

安装后在仪表盘添加：

```yaml
type: custom:elec-summary-card
accounts:
  - key: home_a
    name: 阳光苑
    number: "3203084700001"
```
