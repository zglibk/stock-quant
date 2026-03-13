<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import aiApi from '@/api/ai'

const userStore = useUserStore()
const loading = ref(false)
const saving = ref(false)
const batchTesting = ref(false)
const testingMap = ref({})
const models = ref([])
const selectedParamModel = ref('')
const ownerFilter = ref('all')

const defaults = reactive({
  chatModel: '',
  analysisModel: '',
  visionModel: ''
})

const modelForm = reactive({
  name: '',
  id: '',
  providerType: 'openai',
  model: '',
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  enabled: true,
  isVision: false
})

function defaultParams() {
  return {
    maxTokens: 4096,
    temperature: 1,
    topP: 0.95,
    topK: 20,
    minP: 0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    repetitionPenalty: 1,
    enableThinking: false,
    systemPrompt: ''
  }
}

const paramTooltips = {
  systemPrompt: {
    purpose: '设定 AI 的角色、行为准则和上下文背景。',
    valueGuide: '通常是一段自然语言描述，例如“你是一个专业的金融分析师”。',
    tech: 'System Prompt 会作为对话历史的第一条消息发送给模型，权重较高，能持续影响模型的后续回复风格和逻辑。'
  },
  maxTokens: {
    purpose: '限制 AI 单次回复生成的最大 Token 数量。',
    valueGuide: '通常在 2048 到 8192 之间。设置过小会导致回答被截断，设置过大可能增加延迟和成本。',
    tech: 'Token 是大模型处理文本的基本单位，通常 1 个中文汉字约等于 1-2 个 Token，1 个英文单词约等于 1.3 个 Token。'
  },
  enableThinking: {
    purpose: '是否让 AI 在回答前进行显式的推理思考（CoT）。',
    valueGuide: '开启后 AI 会先输出思考过程，再给出结论。适用于复杂逻辑推理任务。',
    tech: 'Chain of Thought (CoT) 是一种提示工程技术，通过让模型生成中间推理步骤，显著提升其在数学、逻辑和常识推理任务上的表现。'
  },
  temperature: {
    purpose: '控制输出结果的随机性和创造性。',
    valueGuide: '0-0.3：结果专注、确定性高（适合代码）；0.7-1.0：通用对话；>1.0：极具创造性但可能胡言乱语。',
    tech: 'Temperature 参数用于调整模型预测下一个 Token 的概率分布。较高的温度会使概率分布更平缓，增加低概率词被选中的机会。'
  },
  topP: {
    purpose: '另一种控制随机性的方法，与 Temperature 类似但机制不同。',
    valueGuide: '通常设为 0.9 或 0.95。较低的值（如 0.1）会使结果更加确定和保守。建议不要同时大幅调整 Temperature 和 Top-P。',
    tech: 'Nucleus Sampling (Top-P) 仅从累积概率达到 P 的最小候选词集合中进行采样。切断了尾部极低概率的词。'
  },
  topK: {
    purpose: '限制模型仅从概率最高的 K 个词中进行采样。',
    valueGuide: '通常设为 20-100。设为 1 时等同于贪婪解码（总是选概率最高的词）。',
    tech: 'Top-K 是一种硬截断策略，无论后续词的概率差异如何，只保留前 K 个高概率词。它能有效防止模型生成完全离谱的低概率词。'
  },
  minP: {
    purpose: '动态移除概率低于“最高概率 Token * P”的候选词。',
    valueGuide: '通常设为 0.05 或 0.1。',
    tech: 'Min-P 是一种相对阈值截断方法。如果最高概率的词是 0.5，P 是 0.1，那么所有概率低于 0.05 的词都会被剔除。这比 Top-P 更灵活。'
  },
  presencePenalty: {
    purpose: '鼓励模型谈论新话题，惩罚已经出现过的 Token。',
    valueGuide: '范围 -2.0 到 2.0。正值会减少模型重复相同话题的倾向。通常设为 0 到 0.6。',
    tech: '只要一个 Token 在之前的文本中出现过（不论次数），就会对其 Logits 施加惩罚。有助于增加生成内容的主题多样性。'
  },
  frequencyPenalty: {
    purpose: '通过惩罚高频词来减少逐字重复。',
    valueGuide: '范围 -2.0 到 2.0。正值会根据 Token 出现的频率进行惩罚。通常设为 0 到 0.6。',
    tech: '与 Presence Penalty 不同，Frequency Penalty 会根据 Token 出现的次数线性累加惩罚力度。出现次数越多，再次被选中的概率降得越低。'
  },
  repetitionPenalty: {
    purpose: '直接对已生成 Token 的概率进行除法惩罚，强力抑制重复。',
    valueGuide: '1.0 表示无惩罚。通常设为 1.0 到 1.2。设置过高可能导致模型说话变得生硬怪异。',
    tech: '它直接除以 Logits（或在 Softmax 前应用）。与加性的 Presence/Frequency Penalty 相比，它的抑制效果通常更显著且敏感。'
  }
}

const paramEditor = reactive(defaultParams())

const builtinModels = [
  { id: 'deepseek-v3', name: 'DeepSeek V3', providerType: 'openai', model: 'deepseek-ai/DeepSeek-V3', baseURL: 'https://api.deepseek.com/v1', enabled: true, isVision: false },
  { id: 'deepseek-r1', name: 'DeepSeek R1', providerType: 'openai', model: 'deepseek-ai/DeepSeek-R1', baseURL: 'https://api.deepseek.com/v1', enabled: true, isVision: false },
  { id: 'qwen-plus', name: 'Qwen3.5-397B-A17B', providerType: 'openai', model: 'Qwen/Qwen3.5-397B-A17B', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'qwen_vl', name: 'Qwen2.5-VL 72B', providerType: 'openai', model: 'Qwen/Qwen2.5-VL-72B-Instruct', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'qwen_vl_lite', name: 'Qwen2.5-VL 7B', providerType: 'openai', model: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'claude', name: 'Claude 3.5', providerType: 'anthropic', model: 'claude-sonnet-4-20250514', baseURL: '', enabled: true, isVision: false }
]

const myUserId = computed(() => userStore.user?._id || '')
const isAdmin = computed(() => userStore.user?.role === 'admin')
const myModels = computed(() => models.value.filter(m => !m.ownerId || m.ownerId === myUserId.value))
const ownerOptions = computed(() => {
  const map = new Map()
  for (const m of models.value) {
    const key = m.ownerId || 'unknown'
    const label = m.ownerName || '未知用户'
    if (!map.has(key)) map.set(key, label)
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})
const filteredModels = computed(() => {
  if (!isAdmin.value || ownerFilter.value === 'all') return models.value
  return models.value.filter(m => (m.ownerId || 'unknown') === ownerFilter.value)
})
const allEnabledModelOptions = computed(() => models.value.filter(m => m.enabled).map(m => ({
  label: `${m.name}${m.ownerName ? `（${m.ownerName}）` : ''}`,
  value: m.modelRef || m.id
})))
const ownModelOptions = computed(() => myModels.value.map(m => ({
  label: m.name,
  value: m.modelRef || m.id
})))

const selectedModelEntity = computed(() => {
  const ref = selectedParamModel.value
  return myModels.value.find(m => (m.modelRef || m.id) === ref)
})

watch(selectedModelEntity, (m) => {
  Object.assign(paramEditor, m?.params || defaultParams())
}, { immediate: true })

function syncEditorToModel() {
  const m = selectedModelEntity.value
  if (!m) return
  m.params = { ...defaultParams(), ...paramEditor }
}

function resetModelForm() {
  modelForm.name = ''
  modelForm.id = ''
  modelForm.providerType = 'openai'
  modelForm.model = ''
  modelForm.baseURL = 'https://api.siliconflow.cn/v1'
  modelForm.apiKey = ''
  modelForm.enabled = true
  modelForm.isVision = false
}

function addModel() {
  if (!modelForm.name || !modelForm.model || !modelForm.apiKey) {
    ElMessage.warning('请填写模型名称、模型ID与API Key')
    return
  }
  const id = modelForm.id || `custom_${Date.now()}`
  models.value.push({
    id,
    modelRef: `${myUserId.value}::${id}`,
    name: modelForm.name,
    providerType: modelForm.providerType,
    model: modelForm.model,
    baseURL: modelForm.baseURL,
    apiKey: modelForm.apiKey,
    enabled: modelForm.enabled,
    isVision: modelForm.isVision,
    hasApiKey: true,
    ownerId: myUserId.value,
    ownerName: userStore.user?.nickname || userStore.user?.username || '当前用户',
    params: defaultParams()
  })
  selectedParamModel.value = `${myUserId.value}::${id}`
  resetModelForm()
}

function removeModel(ref) {
  models.value = models.value.filter(m => (m.modelRef || m.id) !== ref)
  if (defaults.chatModel === ref) defaults.chatModel = ''
  if (defaults.analysisModel === ref) defaults.analysisModel = ''
  if (defaults.visionModel === ref) defaults.visionModel = ''
  if (selectedParamModel.value === ref) selectedParamModel.value = ownModelOptions.value[0]?.value || ''
}

function isOwnModel(m) {
  return !m.ownerId || m.ownerId === myUserId.value
}

async function testModel(m) {
  const ref = m.modelRef || m.id
  testingMap.value[ref] = true
  try {
    const { data } = await aiApi.testSettings({
      modelRef: ref,
      params: m.params || defaultParams()
    })
    ElMessage.success(`连通成功: ${data.preview || 'OK'}`)
  } catch (err) {
    ElMessage.error(`连通失败: ${err.message || ''}`)
  } finally {
    testingMap.value[ref] = false
  }
}

async function testVisibleModels() {
  const candidates = filteredModels.value.filter(m => m.enabled && m.hasApiKey)
  if (!candidates.length) {
    ElMessage.warning('当前筛选条件下没有可测试模型')
    return
  }
  batchTesting.value = true
  let success = 0
  let failed = 0
  const failedNames = []
  for (const m of candidates) {
    const ref = m.modelRef || m.id
    testingMap.value[ref] = true
    try {
      await aiApi.testSettings({
        modelRef: ref,
        params: m.params || defaultParams()
      })
      success += 1
    } catch {
      failed += 1
      failedNames.push(m.name)
    } finally {
      testingMap.value[ref] = false
    }
  }
  batchTesting.value = false
  if (!failed) {
    ElMessage.success(`批量测试完成：成功 ${success} 个`)
  } else {
    ElMessage.warning(`批量测试完成：成功 ${success} 个，失败 ${failed} 个（${failedNames.slice(0, 3).join('、')}）`)
  }
}

async function testNewModel() {
  if (!modelForm.model || !modelForm.apiKey) {
    ElMessage.warning('请先填写模型ID与API Key')
    return
  }
  testingMap.value.new = true
  try {
    await aiApi.testSettings({
      modelConfig: {
        id: modelForm.id || modelForm.model,
        name: modelForm.name || modelForm.model,
        providerType: modelForm.providerType,
        model: modelForm.model,
        baseURL: modelForm.baseURL,
        apiKey: modelForm.apiKey
      },
      params: defaultParams()
    })
    ElMessage.success('连通测试通过，可添加保存')
  } catch (err) {
    ElMessage.error(`连通测试失败: ${err.message || ''}`)
  } finally {
    testingMap.value.new = false
  }
}

async function loadSettings() {
  loading.value = true
  try {
    await userStore.refreshProfile()
    const { data } = await aiApi.getSettings()
    const fromServer = (data.models || []).map(m => ({ ...m, apiKey: '', params: { ...defaultParams(), ...(m.params || {}) } }))
    const ownIds = new Set(fromServer.filter(m => !m.ownerId || m.ownerId === myUserId.value).map(m => m.id))
    for (const b of builtinModels) {
      if (!ownIds.has(b.id)) {
        fromServer.push({
          ...b,
          modelRef: `${myUserId.value}::${b.id}`,
          ownerId: myUserId.value,
          ownerName: userStore.user?.nickname || userStore.user?.username || '当前用户',
          apiKey: '',
          hasApiKey: false,
          apiKeyPreview: '',
          params: defaultParams()
        })
      }
    }
    models.value = fromServer
    Object.assign(defaults, data.defaults || {})
    selectedParamModel.value = ownModelOptions.value[0]?.value || ''
    ownerFilter.value = 'all'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    syncEditorToModel()
    const payload = {
      models: myModels.value.map(m => ({
        id: m.id,
        name: m.name,
        providerType: m.providerType,
        model: m.model,
        baseURL: m.baseURL,
        apiKey: m.apiKey || undefined,
        enabled: m.enabled,
        isVision: m.isVision,
        params: { ...defaultParams(), ...(m.params || {}) }
      })),
      defaults: { ...defaults }
    }
    await aiApi.updateSettings(payload)
    ElMessage.success('AI 设置已保存')
    await loadSettings()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-4">
    <el-card v-loading="loading" class="sq-list-card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
      <template #header>
        <div class="sq-list-title text-lg font-bold text-gray-900 dark:text-gray-100">添加模型</div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <el-input v-model="modelForm.name" placeholder="模型显示名称" class="dark:text-gray-100" />
        <el-input v-model="modelForm.id" placeholder="模型别名（可选）" class="dark:text-gray-100" />
        <el-select v-model="modelForm.providerType" placeholder="Provider 类型" class="dark:text-gray-100">
          <el-option label="OpenAI 兼容" value="openai" />
          <el-option label="Anthropic" value="anthropic" />
        </el-select>
        <el-input v-model="modelForm.model" placeholder="模型ID，例如 Qwen/Qwen3.5-397B-A17B" class="dark:text-gray-100" />
        <el-input v-model="modelForm.baseURL" placeholder="Base URL，例如 https://api.siliconflow.cn/v1" class="dark:text-gray-100" />
        <el-input v-model="modelForm.apiKey" show-password placeholder="API Key" class="dark:text-gray-100" />
      </div>
      <div class="flex items-center gap-4 mt-3">
        <el-switch v-model="modelForm.enabled" active-text="启用" class="dark:text-gray-100" />
        <el-switch v-model="modelForm.isVision" active-text="支持视觉" class="dark:text-gray-100" />
        <el-button :loading="testingMap.new" @click="testNewModel" class="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">连通性测试</el-button>
        <el-button type="primary" @click="addModel">添加模型</el-button>
      </div>
    </el-card>

    <el-card class="sq-list-card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="sq-list-title text-lg font-bold text-gray-900 dark:text-gray-100">模型列表</div>
          <div class="flex items-center gap-2">
            <el-select v-if="isAdmin" v-model="ownerFilter" style="width: 220px" placeholder="按创建人筛选" class="dark:text-gray-100">
              <el-option label="全部创建人" value="all" />
              <el-option v-for="o in ownerOptions" :key="`owner-${o.value}`" :label="o.label" :value="o.value" />
            </el-select>
            <el-button :loading="batchTesting" @click="testVisibleModels" class="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">批量连通测试</el-button>
          </div>
        </div>
      </template>
      <div class="space-y-2">
        <div v-for="m in filteredModels" :key="m.modelRef || m.id" class="border border-slate-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between gap-2 bg-slate-50/40 dark:bg-gray-900/40 text-gray-900 dark:text-gray-100">
          <div class="text-sm">
            <div class="font-semibold text-gray-900 dark:text-gray-100">
              {{ m.name }} <span class="text-gray-500 dark:text-gray-400">({{ m.id }})</span>
              <span v-if="m.ownerName" class="text-xs text-blue-500 dark:text-blue-400 ml-2">创建人: {{ m.ownerName }}</span>
            </div>
            <div class="text-gray-600 dark:text-gray-400">{{ m.model }}</div>
            <div class="text-gray-500 dark:text-gray-400">{{ m.baseURL }}</div>
            <div class="text-gray-500 dark:text-gray-400">Key: {{ m.apiKeyPreview || (m.hasApiKey ? '已配置' : '未配置') }}</div>
          </div>
          <div class="flex items-center gap-2">
            <el-switch v-model="m.enabled" :disabled="!isOwnModel(m)" />
            <el-button :loading="testingMap[m.modelRef || m.id]" @click="testModel(m)" class="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">测试</el-button>
            <el-button v-if="isOwnModel(m)" type="danger" plain @click="removeModel(m.modelRef || m.id)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="sq-list-card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
      <template #header>
        <div class="sq-list-title text-lg font-bold text-gray-900 dark:text-gray-100">默认模型</div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <el-select v-model="defaults.chatModel" placeholder="聊天默认模型" class="dark:text-gray-100">
          <el-option v-for="m in allEnabledModelOptions" :key="`chat-${m.value}`" :label="m.label" :value="m.value" />
        </el-select>
        <el-select v-model="defaults.analysisModel" placeholder="分析默认模型" class="dark:text-gray-100">
          <el-option v-for="m in allEnabledModelOptions" :key="`analysis-${m.value}`" :label="m.label" :value="m.value" />
        </el-select>
        <el-select v-model="defaults.visionModel" placeholder="视觉默认模型" class="dark:text-gray-100">
          <el-option v-for="m in allEnabledModelOptions" :key="`vision-${m.value}`" :label="m.label" :value="m.value" />
        </el-select>
      </div>
    </el-card>

    <el-card class="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
      <template #header>
        <div class="sq-section-title">按模型参数调节</div>
      </template>
      <div class="mb-3">
        <el-select v-model="selectedParamModel" placeholder="选择要调参的模型" class="dark:text-gray-100">
          <el-option v-for="m in ownModelOptions" :key="`param-${m.value}`" :label="m.label" :value="m.value" />
        </el-select>
      </div>
      <div class="space-y-4" v-if="selectedModelEntity">
        <div>
          <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
            <span>系统提示词 (System Prompt)</span>
            <el-tooltip placement="top" effect="dark">
              <template #content>
                <div class="max-w-xs space-y-2">
                  <div class="font-bold text-base">系统提示词 (System Prompt)</div>
                  <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.systemPrompt.purpose }}</div>
                  <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.systemPrompt.valueGuide }}</div>
                  <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.systemPrompt.tech }}</div>
                </div>
              </template>
              <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <el-input v-model="paramEditor.systemPrompt" type="textarea" :rows="3" @input="syncEditorToModel" class="dark:text-gray-100" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>最大生成长度 (Max Tokens): {{ paramEditor.maxTokens }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">最大生成长度 (Max Tokens)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.maxTokens.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.maxTokens.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.maxTokens.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.maxTokens" :min="256" :max="32768" :step="256" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>启用思维链 (Enable Thinking)</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">启用思维链 (Enable Thinking)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.enableThinking.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.enableThinking.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.enableThinking.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-switch v-model="paramEditor.enableThinking" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>随机性 (Temperature): {{ paramEditor.temperature }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">随机性 (Temperature)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.temperature.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.temperature.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.temperature.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.temperature" :min="0" :max="2" :step="0.01" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>核采样 (Top-P): {{ paramEditor.topP }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">核采样 (Top-P)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.topP.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.topP.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.topP.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.topP" :min="0" :max="1" :step="0.01" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>Top-K 采样: {{ paramEditor.topK }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">Top-K 采样</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.topK.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.topK.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.topK.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.topK" :min="0" :max="200" :step="1" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>Min-P 截断: {{ paramEditor.minP }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">Min-P 截断</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.minP.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.minP.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.minP.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.minP" :min="0" :max="1" :step="0.01" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>存在惩罚 (Presence Penalty): {{ paramEditor.presencePenalty }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">存在惩罚 (Presence Penalty)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.presencePenalty.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.presencePenalty.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.presencePenalty.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.presencePenalty" :min="-2" :max="2" :step="0.01" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>频率惩罚 (Frequency Penalty): {{ paramEditor.frequencyPenalty }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">频率惩罚 (Frequency Penalty)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.frequencyPenalty.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.frequencyPenalty.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.frequencyPenalty.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.frequencyPenalty" :min="-2" :max="2" :step="0.01" @change="syncEditorToModel" />
          </div>
          <div>
            <div class="mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <span>重复惩罚 (Repetition Penalty): {{ paramEditor.repetitionPenalty }}</span>
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-xs space-y-2">
                    <div class="font-bold text-base">重复惩罚 (Repetition Penalty)</div>
                    <div><span class="font-semibold text-blue-300">控制目的：</span>{{ paramTooltips.repetitionPenalty.purpose }}</div>
                    <div><span class="font-semibold text-green-300">数值说明：</span>{{ paramTooltips.repetitionPenalty.valueGuide }}</div>
                    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2 bg-gray-800/50 p-2 rounded">{{ paramTooltips.repetitionPenalty.tech }}</div>
                  </div>
                </template>
                <el-icon class="cursor-help text-gray-400 hover:text-blue-400"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <el-slider v-model="paramEditor.repetitionPenalty" :min="0" :max="2" :step="0.01" @change="syncEditorToModel" />
          </div>
        </div>
      </div>
      <div class="mt-6">
        <el-button type="primary" :loading="saving" @click="saveSettings">保存 AI 设置</el-button>
      </div>
    </el-card>
  </div>
</template>
