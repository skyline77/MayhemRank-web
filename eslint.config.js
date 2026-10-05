import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'src/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: globals.browser },
    rules: {
      // 调整属性顺序会改变 v-bind 对象与单独属性的覆盖关系，不自动重排
      'vue/attributes-order': 'off',
      // TS 可选 props 本身表达了缺省语义，不强制写默认值
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  // 格式交给 Prettier，关闭与之冲突的规则
  prettier,
)
