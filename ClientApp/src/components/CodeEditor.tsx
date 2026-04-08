import React, {useMemo} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {json} from '@codemirror/lang-json';
import {vscodeDark, vscodeLight} from '@uiw/codemirror-theme-vscode';
import {placeholder} from '@codemirror/view';
import {cn} from '../lib/utils';
import {useThemeOptional} from '../theme-context';

export type CodeEditorLanguage = 'javascript' | 'json';

export const CodeEditor: React.FC<{
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: CodeEditorLanguage;
  /** Высота редактора (CSS), напр. 200px, calc(...), 100% */
  height?: string;
  className?: string;
  placeholder?: string;
}> = ({value, onChange, readOnly, language = 'javascript', height = '220px', className, placeholder: placeholderText}) => {
  const themeCtx = useThemeOptional();
  const cmTheme = themeCtx?.theme === 'light' ? vscodeLight : vscodeDark;

  const extensions = useMemo(() => {
    const lang = language === 'json' ? json() : javascript();
    return placeholderText ? [lang, placeholder(placeholderText)] : [lang];
  }, [language, placeholderText]);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={cmTheme}
      extensions={extensions}
      onChange={onChange ?? (() => {})}
      editable={!readOnly}
      readOnly={readOnly}
      className={cn('overflow-hidden rounded-lg border border-outline-variant/20 shadow-inner', className)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        defaultKeymap: true,
        closeBrackets: true,
        autocompletion: !readOnly,
      }}
    />
  );
};
