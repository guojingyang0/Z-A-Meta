
export const TRANSLATIONS = {
  en: {
    appTitle: "Z-A META",
    metaSubtitle: "Real-time Environment Monitoring & Win Rate Analysis",
    meta: "META",
    analyzer: "UNIT ANALYSIS",
    builder: "BUILDER",
    typeChart: "TYPE CHART",
    liveConnection: "LIVE CONNECTION",
    systemStatus: "SYSTEM STATUS",
    operational: "OPERATIONAL",
    activeReg: "ACTIVE REGULATION",
    preview: "Reg H / Z-A Preview",
    aiModel: "AI MODEL",
    connecting: "Establishing uplink to Battle Database...",
    failedMeta: "Failed to retrieve meta analysis.",
    errorConnection: "Error connecting to Z-A Network.",
    winRate: "Win Rate",
    usageRate: "Usage",
    keyMoves: "Common Moves",
    
    // Pagination
    prevPage: "Prev",
    nextPage: "Next",

    // Generations
    genSelect: "GENERATION",
    envLegendsZA: "Legends Z-A (Action RPG Meta)",
    envGen9: "Gen 9 Paldea (Regulation H)",
    envGen8: "Gen 8 Galar (Dynamax Format)",
    envGen6: "Gen 6 Kalos (Mega Evolution)",
    seasonZA: "SEASON",
    
    // Mechanics
    mechanicNote: "Mechanics: Real-time Action. Speed = CDR. Earthquake = AOE.",

    // Methodology
    methodologyBtn: "Analysis Logic",
    methodologyTitle: "Mathematical Matrix Model",
    methodologyDesc: "Win Rates are not AI guesses. They are calculated locally using a strict mathematical matrix that cross-references every Pokémon in the current list:",
    methodologyPoint1: "Stat Dominance: Weighted HP > Offense > Defense > Speed (CDR).",
    methodologyPoint2: "Meta Matchup Matrix: We simulate Type Matchups for every Pokémon against every other Top 25 Pokémon to derive a 'Meta Dominance Score'.",
    methodologyPoint3: "Mechanics Factor: Bonus points for AOE capabilities (Z-A engine) and high Mobility.",
    methodologyPoint4: "Final Win Rate = Stats (35%) + Matchup Matrix (45%) + Mechanics (20%).",
    methodologyNote: "This model ensures that Win Rates update dynamically based on the composition of the current meta environment.",

    // Analyzer
    enterPokemon: "Enter Pokémon Name (e.g. Flutter Mane)",
    analyzeBtn: "UNIT ANALYSIS",
    analyzingBtn: "ANALYZING...",
    role: "ROLE",
    tier: "TIER",
    beats: "Key Targets (Beats)",
    losesTo: "Threats (Loses To)",
    partners: "Recommended Partners",
    coverage: "Coverage (Non-STAB Moves)", 
    baseStats: "Base Stats",
    currentForm: "Current Form",
    prevForm: "Base / Pre-Evo",
    errorAnalyze: "Could not analyze Pokémon. Please check spelling.",
    statSpeed: "SPE (CDR)",
    battleTopology: "Neural Matchup Network (Drag to Organize)",
    viewSimple: "Simple",
    viewAdvanced: "Topology",

    // Builder
    builderTitle: "TACTICAL TEAM FABRICATOR",
    builderDesc: "Input a strategy, archetype, or core Pokémon. The AI will construct a synergistic team with items, abilities (if applicable), and movesets optimized for the selected generation's meta.",
    builderPlaceholder: "Describe your strategy (e.g., 'AOE Spam with Earthquake')",
    generateBtn: "GENERATE",
    buildingBtn: "BUILDING...",
    item: "ITEM",
    ability: "ABILITY",
    nature: "NATURE",
    moveset: "MOVESET",

    // Calculator
    defAnalysis: "Defensive Analysis",
    primaryType: "Primary Type",
    secondaryType: "Secondary Type (Optional)",
    weaknesses: "Weaknesses",
    resistances: "Resistances",
    noWeakness: "No weaknesses found.",
    noResistance: "No resistances found.",
  },
  zh: {
    appTitle: "Z-A META",
    metaSubtitle: "实时环境监控与胜率大数据分析",
    meta: "环境监控",
    analyzer: "单体分析",
    builder: "战术构建",
    typeChart: "属性计算",
    liveConnection: "实时连接",
    systemStatus: "系统状态",
    operational: "运行中",
    activeReg: "当前规则",
    preview: "规则 H / Z-A 前瞻",
    aiModel: "AI 模型",
    connecting: "正在建立与对战数据库的连接...",
    failedMeta: "无法获取环境分析报告。",
    errorConnection: "连接 Z-A 网络失败。",
    winRate: "预测胜率",
    usageRate: "使用率",
    keyMoves: "常见配招",
    
    // Pagination
    prevPage: "上一页",
    nextPage: "下一页",

    // Generations
    genSelect: "世代选择",
    envLegendsZA: "传说 Z-A (即时动作对战)",
    envGen9: "第九世代 帕底亚 (规则 H)",
    envGen8: "第八世代 伽勒尔 (极巨化)",
    envGen6: "第六世代 卡洛斯 (Mega 进化)",
    seasonZA: "当前赛季",
    
    // Mechanics
    mechanicNote: "环境机制：速度属性转为冷却缩减 (CDR)，部分技能具备广域 AOE 判定。",

    // Methodology
    methodologyBtn: "分析依据",
    methodologyTitle: "数学矩阵模型算法",
    methodologyDesc: "胜率并非AI随机生成，而是通过本地数学矩阵模型，将当前环境中的所有宝可梦进行交叉对比计算得出：",
    methodologyPoint1: "种族统治力：权重调整为 HP > 双攻 > 双防 > 速度 (CDR)。",
    methodologyPoint2: "环境对战矩阵：系统模拟每只宝可梦与榜单上其他所有宝可梦的属性攻防优劣，得出 '环境统治分'。",
    methodologyPoint3: "机制适应性因子：针对 Z-A 引擎的 AOE (范围伤害) 能力与高机动性给予额外加权。",
    methodologyPoint4: "最终胜率公式 = 种族分(35%) + 对战矩阵分(45%) + 机制分(20%)。",
    methodologyNote: "该模型确保胜率会根据当前环境（Meta）的宝可梦构成动态变化，而非固定数值。",

    // Analyzer
    enterPokemon: "输入宝可梦名称 (例如: 振翼发)",
    analyzeBtn: "单体分析",
    analyzingBtn: "分析中...",
    role: "定位",
    tier: "分级",
    beats: "打击目标 (优势)",
    losesTo: "主要威胁 (劣势)",
    partners: "推荐队友",
    coverage: "补盲打击面 (非本系)", 
    baseStats: "种族值",
    currentForm: "当前形态",
    prevForm: "基础/进化前",
    errorAnalyze: "无法分析该宝可梦，请检查拼写。",
    statSpeed: "速度 (CDR)",
    battleTopology: "对战神经网络 (可拖拽整理)",
    viewSimple: "简单",
    viewAdvanced: "拓扑模式",

    // Builder
    builderTitle: "战术队伍构建器",
    builderDesc: "输入战术思路、队伍原型或核心宝可梦。AI将为您构建适应所选世代环境的完整队伍，包含道具、特性 (如适用) 及配招。",
    builderPlaceholder: "描述你的战术 (例如：'地震大范围AOE流')",
    generateBtn: "生成队伍",
    buildingBtn: "构建中...",
    item: "道具",
    ability: "特性",
    nature: "性格",
    moveset: "配招",

    // Calculator
    defAnalysis: "防御面分析",
    primaryType: "第一属性",
    secondaryType: "第二属性 (可选)",
    weaknesses: "弱点 (被克制)",
    resistances: "抗性 (抵抗)",
    noWeakness: "未发现弱点。",
    noResistance: "未发现抗性。",
  }
};
