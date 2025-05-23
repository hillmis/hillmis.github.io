class Editor {
    constructor() {
        this.editorContainer = document.getElementById('CodeMirror-editor');
        this.editorTabs = document.querySelector('.editor-tabs');
        this.languageSelector = document.querySelector('.language-selector');
        this.previewFrame = document.getElementById('preview-frame');
        this.openFiles = new Map();
        this.currentFile = null;
        this.autoPreviewEnabled = true;
        this.defaultContent = '';

        // 创建logo元素
        this.logo = document.createElement('img');
        this.logo.src = 'logo.png';
        this.logo.className = 'editor-logo';
        this.editorContainer.appendChild(this.logo);
        this.logo.style.display = 'none';

        document.addEventListener('DOMContentLoaded', () => {
            this.initializeEditor();
            this.initializeEventListeners();
        });


    }

    async initializeEditor() {
        // 初始化CodeMirror编辑器
        this.editor = CodeMirror(this.editorContainer, {
            value: this.defaultContent,
            mode: 'text/html',
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: false,
            tabSize: 4,
            indentWithTabs: false,
            matchBrackets: true,
            autoCloseBrackets: true,
            scrollPastEnd: true,
            extraKeys: {
                "Ctrl-F": "findPersistent",
                "Cmd-F": "findPersistent",
                "Ctrl-Z": () => this.undo(),
                "Shift-Ctrl-Z": () => this.redo(),
                "Cmd-Z": () => this.undo(),
                "Shift-Cmd-Z": () => this.redo()
            }
        });

        // 初始显示控制
        if (this.openFiles.size === 0) {
            this.logo.style.display = 'block';
            this.editor.getWrapperElement().style.display = 'none';
        }

        // 内容变化监听
        this.editor.on('change', () => {
            if (this.currentFile) {
                const content = this.editor.getValue();
                window.fileManager.files.set(this.currentFile, content);

                if (window.fileManager?.saveToIndexedDB) {
                    window.fileManager.saveToIndexedDB();
                }

                this.updatePreview();
            }
        });
    }

    initializeEventListeners() {
        window.addEventListener('file-open', (event) => {
            const { path, content } = event.detail;
            this.openFile(path, content);
        });

        window.addEventListener('file-renamed', (event) => {
            const { oldPath, newPath } = event.detail;
            this.handleFileRename(oldPath, newPath);
        });

        if (this.languageSelector) {
            this.languageSelector.addEventListener('change', () => {
                if (this.currentFile) {
                    const language = this.languageSelector.value;
                    this.editor.setOption('mode', this.getCodeMirrorMode(language));
                }
            });
        }

        if (this.editorTabs) {
            Utils.delegate(this.editorTabs, 'click', '.editor-tab', (event) => {
                const closeBtn = event.target.closest('.close-tab');
                const tab = event.target.closest('.editor-tab');

                if (closeBtn) {
                    this.closeFile(tab.dataset.path);
                } else {
                    this.switchToFile(tab.dataset.path);
                }
            });
        }

        // 查找按钮事件
        const findBtn = document.querySelector('[title="查找和替换"]');
        if (findBtn) {
            findBtn.addEventListener('click', () => {
                this.toggleFindWidget();
            });
        }

        // 撤销按钮事件
        const undoBtn = document.getElementById('undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undo();
            });
        }

        // 重做按钮事件
        const redoBtn = document.getElementById('redo');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                this.redo();
            });
        }
    }

    // 撤销操作
    undo() {
        if (this.editor) {
            this.editor.undo();
        }
    }

    // 重做操作
    redo() {
        if (this.editor) {
            this.editor.redo();
        }
    }

    createTab(path) {
        const fileName = path === 'untitled' ? 'Untitled' : path.split('/').pop();
        const extension = path === 'untitled' ? 'txt' : path.split('.').pop();

        const tab = Utils.createElement('div', {
            className: 'editor-tab',
            'data-path': path
        }, [
            Utils.createElement('i', { className: this.getFileIcon(extension) }),
            document.createTextNode(fileName),
            Utils.createElement('span', { className: 'close-tab' }, [
                Utils.createElement('i', { className: 'fas fa-times' })
            ])
        ]);

        this.editorTabs.appendChild(tab);
        return tab;
    }

    getFileIcon(extension) {
        const iconMap = {
            js: 'fab fa-js',
            html: 'fab fa-html5',
            css: 'fab fa-css3',
            json: 'fas fa-code',
            md: 'fas fa-file-alt'
        };
        return iconMap[extension] || 'fas fa-file-code';
    }

    getLanguageFromExtension(extension) {
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'htm': 'html',
            'xhtml': 'html',
            'css': 'css',
            'scss': 'css',
            'sass': 'css',
            'less': 'css',
            'json': 'json',
            'md': 'markdown',
            'markdown': 'markdown',
            'py': 'python',
            'rb': 'ruby',
            'php': 'php',
            'c': 'c',
            'h': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'hpp': 'cpp',
            'java': 'java',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'kts': 'kotlin',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'sh': 'shell',
            'bash': 'shell',
            'zsh': 'shell',
            'sql': 'sql',
            'vue': 'html',
            'svelte': 'html'
        };
        return languageMap[extension.toLowerCase()] || 'plaintext';
    }

    switchToFile(path) {
        if (!this.openFiles.has(path)) return;

        const file = this.openFiles.get(path);
        this.currentFile = path;

        this.editor.setValue(file.content || '');
        this.editor.setOption('mode', file.mode);
        this.editor.refresh();

        // 自动更新语言选择器
        if (this.languageSelector) {
            const extension = path.split('.').pop().toLowerCase();
            const language = this.getLanguageFromExtension(extension);

            // 找到匹配的选项，优先完全匹配，然后是包含匹配
            let foundOption = false;
            for (let i = 0; i < this.languageSelector.options.length; i++) {
                const option = this.languageSelector.options[i];
                if (option.value === language) {
                    this.languageSelector.value = language;
                    foundOption = true;
                    break;
                }
            }

            // 如果没有完全匹配的选项，尝试部分匹配
            if (!foundOption) {
                for (let i = 0; i < this.languageSelector.options.length; i++) {
                    const option = this.languageSelector.options[i];
                    if (option.value.includes(language) || language.includes(option.value)) {
                        this.languageSelector.value = option.value;
                        foundOption = true;
                        break;
                    }
                }
            }

            // 如果还是没有匹配的选项，设置为plaintext
            if (!foundOption) {
                this.languageSelector.value = 'plaintext';
            }
        }

        const tabs = this.editorTabs.querySelectorAll('.editor-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.path === path);
        });

        this.updatePreview();

        if (window.fileManager) {
            window.fileManager.highlightSelectedFile(path);
        }
    }

    getCodeMirrorMode(language) {
        const modeMap = {
            'javascript': 'javascript',
            'typescript': 'javascript',
            'html': 'htmlmixed',
            'css': 'css',
            'scss': 'css',
            'less': 'css',
            'json': 'application/json',
            'markdown': 'markdown',
            'python': 'python',
            'ruby': 'ruby',
            'php': 'php',
            'c': 'text/x-csrc',
            'cpp': 'text/x-c++src',
            'java': 'text/x-java',
            'go': 'go',
            'rust': 'rust',
            'kotlin': 'text/x-kotlin',
            'xml': 'xml',
            'yaml': 'yaml',
            'shell': 'shell',
            'sql': 'sql'
        };
        return modeMap[language] || 'text/plain';
    }

    openFile(path, content) {

        if (this.openFiles.has(path)) {
            this.switchToFile(path);
            return;
        }

        const extension = path.split('.').pop();
        const language = this.getLanguageFromExtension(extension);

        this.openFiles.set(path, {
            content: content,
            mode: this.getCodeMirrorMode(language)
        });

        this.createTab(path);
        this.switchToFile(path);

        if (window.fileManager) {
            window.fileManager.highlightSelectedFile(path);
            window.fileManager.updateCurrentPathDisplay(path);
        }

        if (this.openFiles.size === 1) {
            this.logo.style.display = 'none';
            this.editor.getWrapperElement().style.display = 'block';
            this.editor.refresh();
        }
    }



    closeFile(path) {
        if (!this.openFiles.has(path)) return;

        const tab = this.editorTabs.querySelector(`.editor-tab[data-path="${path}"]`);
        if (tab) tab.remove();

        this.openFiles.delete(path);

        if (this.currentFile === path) {
            const nextFile = this.openFiles.keys().next().value;
            if (nextFile) {
                this.switchToFile(nextFile);
            } else {
                this.currentFile = null;
                this.editor.setValue(this.defaultContent);
                this.editor.setOption('mode', 'text/plain');
                this.logo.style.display = 'block';
                this.editor.getWrapperElement().style.display = 'none';
                if (this.previewFrame) this.previewFrame.srcdoc = '';
                window.dispatchEvent(new CustomEvent('clear-preview'));
            }
        }
    }

    updatePreview() {
        if (!this.currentFile) return;

        const extension = this.currentFile.split('.').pop().toLowerCase();
        const content = this.editor.getValue();

        if (extension === 'html') {
            window.dispatchEvent(new CustomEvent('content-change', {
                detail: { content: content }
            }));
        }
        else if ((extension === 'css' || extension === 'js') && this.previewFrame) {
            window.fileManager.files.set(this.currentFile, content);

            let htmlFile = Array.from(this.openFiles.keys()).find(file =>
                file.endsWith('index.html'));
            if (!htmlFile) {
                htmlFile = Array.from(window.fileManager.files.keys()).find(file =>
                    file.endsWith('.html'));
            }

            if (htmlFile) {
                const htmlContent = window.fileManager.files.get(htmlFile);
                htmlContent && window.dispatchEvent(new CustomEvent('content-change', {
                    detail: { content: htmlContent }
                }));
            }
        }
    }

    toggleFindWidget() {
        this.editor.execCommand('find');
    }

    handleFileRename(oldPath, newPath) {
        if (this.openFiles.has(oldPath)) {
            const file = this.openFiles.get(oldPath);
            this.openFiles.set(newPath, file);
            this.openFiles.delete(oldPath);

            if (this.currentFile === oldPath) {
                this.currentFile = newPath;
            }

            const tab = this.editorTabs.querySelector(`.editor-tab[data-path="${oldPath}"]`);
            if (tab) {
                tab.dataset.path = newPath;
                tab.querySelector('span').textContent = newPath.split('/').pop();
            }
        }
    }
}

window.editor = new Editor();
