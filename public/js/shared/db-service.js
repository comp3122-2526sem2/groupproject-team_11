/**
 * db-service.js
 * Centralized CRUD service for Supabase.
 * Depends on supabase-config.js (must be loaded first).
 *
 * All methods are static for easy usage without instantiation:
 *   DBService.saveProblem(...)
 */

class DBService {

    // ── Helpers ──────────────────────────────────────────

    static _client() {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized. Check supabase-config.js.');
        }
        return window.supabaseClient;
    }

    static _userId() {
        return window.getAnonymousUserId();
    }

    /**
     * Extract a short title from question data.
     */
    static _extractTitle(type, questionData) {
        let raw = '';
        if (type === 'geometry') {
            raw = questionData?.question_template?.text || '';
        } else if (type === 'algebra') {
            raw = questionData?.question?.text || '';
        }
        // Strip LaTeX, HTML, and trim
        raw = raw.replace(/\$\$?[^$]*\$\$?/g, '[式]')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return raw.substring(0, 60) || '未命名題目';
    }

    // ═══════════════════════════════════════════════════════
    //  SAVED PROBLEMS
    // ═══════════════════════════════════════════════════════

    /**
     * Save a generated problem to the database.
     * @param {'geometry'|'algebra'} type
     * @param {Object} questionData - Full AI response JSON
     * @param {Object} variables - Current slider variable snapshot
     * @param {Object} meta - { topic, subtopic?, difficulty }
     * @returns {Object} The inserted row
     */
    static async saveProblem(type, questionData, variables, meta) {
        const { data, error } = await this._client()
            .from('saved_problems')
            .insert({
                user_id: this._userId(),
                type,
                title: this._extractTitle(type, questionData),
                topic: meta.topic || '',
                subtopic: meta.subtopic || null,
                difficulty: meta.difficulty || 'DSE_Level_4',
                question_data: questionData,
                variables: variables || {}
            })
            .select()
            .single();

        if (error) throw new Error(`Save failed: ${error.message}`);
        return data;
    }

    /**
     * List all saved problems for the current user.
     * @param {Object} [filters] - Optional { type, difficulty, topic }
     * @returns {Array} Array of problem rows
     */
    static async listProblems(filters = {}) {
        let query = this._client()
            .from('saved_problems')
            .select('*')
            .eq('user_id', this._userId())
            .order('created_at', { ascending: false });

        if (filters.type) query = query.eq('type', filters.type);
        if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
        if (filters.topic) query = query.ilike('topic', `%${filters.topic}%`);
        if (filters.favorite) query = query.eq('is_favorite', true);

        const { data, error } = await query;
        if (error) throw new Error(`List failed: ${error.message}`);
        return data || [];
    }

    /**
     * Load a single saved problem by ID.
     */
    static async loadProblem(problemId) {
        const { data, error } = await this._client()
            .from('saved_problems')
            .select('*')
            .eq('id', problemId)
            .eq('user_id', this._userId())
            .single();

        if (error) throw new Error(`Load failed: ${error.message}`);
        return data;
    }

    /**
     * Delete a saved problem.
     */
    static async deleteProblem(problemId) {
        const { error } = await this._client()
            .from('saved_problems')
            .delete()
            .eq('id', problemId)
            .eq('user_id', this._userId());

        if (error) throw new Error(`Delete failed: ${error.message}`);
    }

    /**
     * Export a problem. Returns content as a downloadable blob.
     * @param {Object} problemRow - Full row from listProblems/loadProblem
     * @param {'json'|'txt'|'pdf'} format
     */
    static exportProblem(problemRow, format = 'json') {
        if (format === 'json') {
            return this._exportAsJson(problemRow);
        }
        if (format === 'pdf') {
            return this._exportAsPdf(problemRow);
        }
        return this._exportAsTxt(problemRow);
    }

    static _exportAsJson(row) {
        const payload = {
            type: row.type,
            topic: row.topic,
            subtopic: row.subtopic,
            difficulty: row.difficulty,
            questionData: row.question_data,
            variables: row.variables,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const filename = `math-problem-${row.type}-${row.id.substring(0, 8)}.json`;
        DBService._downloadBlob(blob, filename);
    }

    static _exportAsTxt(row) {
        const qd = row.question_data;
        const lines = [];

        lines.push('═══════════════════════════════════════');
        lines.push('  Math Exploration Hub — 題目導出');
        lines.push('═══════════════════════════════════════');
        lines.push(`類型：${row.type === 'geometry' ? '幾何' : '代數'}`);
        lines.push(`課題：${row.topic}`);
        if (row.subtopic) lines.push(`子課題：${row.subtopic}`);
        lines.push(`難度：${row.difficulty}`);
        lines.push(`導出時間：${new Date().toLocaleString('zh-HK')}`);
        lines.push('');

        // Question text
        lines.push('── 題目敘述 ──');
        if (row.type === 'algebra') {
            const text = (qd.question?.text || '').replace(/\$/g, '');
            lines.push(text);
            (qd.question?.parts || []).forEach(p => {
                lines.push(`${p.label} ${p.text.replace(/\$/g, '')} (${p.marks} 分)`);
            });
        } else {
            lines.push((qd.question_template?.text || '').replace(/\$/g, '').replace(/_\{\{.*?\}\}_/g, '[變數]'));
        }
        lines.push('');

        // Solution (algebra only)
        if (row.type === 'algebra' && qd.solution?.steps) {
            lines.push('── 解題步驟 ──');
            qd.solution.steps.forEach((s, i) => {
                lines.push(`${i + 1}. ${s.description} → ${(s.expression || '').replace(/\$/g, '')}`);
            });
            if (qd.solution.final_answer) {
                lines.push(`最終答案：${qd.solution.final_answer.replace(/\$/g, '')}`);
            }
            lines.push('');
        }

        // Marking scheme
        const steps = row.type === 'algebra' ? qd.marking_scheme?.steps : qd.marking_scheme?.steps;
        if (steps?.length) {
            lines.push('── 評分標準 ──');
            steps.forEach(s => {
                lines.push(`• ${s.description}  [${s.marks}${s.markType}]`);
            });
            if (qd.marking_scheme?.total_marks) {
                lines.push(`總分：${qd.marking_scheme.total_marks}`);
            }
        }

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const filename = `math-problem-${row.type}-${row.id.substring(0, 8)}.txt`;
        DBService._downloadBlob(blob, filename);
    }

    /**
     * Build the styled HTML for a single problem.
     * Reusable for both single and batch export.
     */
    static _buildProblemHtml(row, index) {
        const qd = row.question_data;
        const typeLabel = row.type === 'geometry' ? '幾何' : '代數';
        const diffMap = { DSE_Level_2: 'Level 2 (基礎)', DSE_Level_4: 'Level 4 (中階)', DSE_Level_5_star: 'Level 5* (進階)' };
        const diffLabel = diffMap[row.difficulty] || row.difficulty;
        const exportTime = new Date().toLocaleString('zh-HK');

        let html = '';

        // If batch export, add a separator between problems
        if (index > 0) {
            html += `<div style="border-top: 3px dashed #c7d2fe; margin: 32px 0;"></div>`;
        }

        // Problem number badge for batch
        if (index !== undefined) {
            html += `<div style="display:inline-block; background:#6366f1; color:white; padding:4px 14px; border-radius: 999px; font-size:13px; font-weight:700; margin-bottom:12px;">第 ${index + 1} 題</div>`;
        }

        // Metadata table
        html += `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                <tr>
                    <td style="padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700; width: 80px;">類型</td>
                    <td style="padding: 6px 12px; border: 1px solid #e2e8f0;">${typeLabel}</td>
                    <td style="padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700; width: 80px;">難度</td>
                    <td style="padding: 6px 12px; border: 1px solid #e2e8f0;">${diffLabel}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700;">課題</td>
                    <td style="padding: 6px 12px; border: 1px solid #e2e8f0;" colspan="3">${this._escHtml(row.topic)}${row.subtopic ? ' → ' + this._escHtml(row.subtopic) : ''}</td>
                </tr>
            </table>
        `;

        // ── Question section ──
        html += `<div style="font-size: 16px; font-weight: 800; color: #6366f1; margin-bottom: 8px; border-left: 4px solid #6366f1; padding-left: 10px;">題目敘述</div>`;
        if (row.type === 'algebra') {
            const text = qd.question?.text || '';
            html += `<div style="margin-bottom: 12px; padding: 12px 16px; background: #fafafe; border: 1px solid #e2e8f0; border-radius: 8px;">${text}</div>`;
            if (qd.question?.parts?.length) {
                html += `<div style="margin-bottom: 16px;">`;
                qd.question.parts.forEach(p => {
                    html += `<div style="padding: 4px 0;"><strong>${this._escHtml(p.label)}</strong> ${p.text} <span style="color:#6366f1; font-weight:600;">(${p.marks} 分)</span></div>`;
                });
                html += `</div>`;
            }
        } else {
            let text = qd.question_template?.text || '';
            if (row.variables) {
                Object.entries(row.variables).forEach(([k, v]) => {
                    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
                });
            }
            html += `<div style="margin-bottom: 16px; padding: 12px 16px; background: #fafafe; border: 1px solid #e2e8f0; border-radius: 8px;">${text}</div>`;
        }

        // ── Geometry figure placeholder ──
        if (row.type === 'geometry' && qd.figure_code) {
            html += `<div style="font-size: 16px; font-weight: 800; color: #6366f1; margin: 16px 0 8px; border-left: 4px solid #6366f1; padding-left: 10px;">幾何圖形</div>`;
            html += `<div class="pdf-figure-placeholder" data-problem-id="${row.id}" style="text-align: center; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 8px; margin-bottom: 16px; min-height: 200px;"></div>`;
        }

        // ── Solution (algebra) ──
        if (row.type === 'algebra' && qd.solution?.steps?.length) {
            html += `<div style="font-size: 16px; font-weight: 800; color: #6366f1; margin: 16px 0 8px; border-left: 4px solid #6366f1; padding-left: 10px;">解題步驟</div>`;
            html += `<div style="margin-bottom: 16px;">`;
            qd.solution.steps.forEach((s, i) => {
                html += `<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="display:inline-block; width:24px; height:24px; background:#6366f1; color:white; border-radius:50%; text-align:center; line-height:24px; font-size:12px; font-weight:700; margin-right:8px;">${i + 1}</span>
                    <strong>${s.description || ''}</strong>
                    ${s.expression ? `<div style="margin-left:36px; color:#475569; font-size:14px;">$$${s.expression.replace(/^\$+|\$+$/g, '')}$$</div>` : ''}
                </div>`;
            });
            if (qd.solution.final_answer) {
                html += `<div style="margin-top: 8px; padding: 10px 14px; background: #eef2ff; border-radius: 8px; font-weight: 700; color: #4338ca;">
                    最終答案：$$${qd.solution.final_answer.replace(/^\$+|\$+$/g, '')}$$
                </div>`;
            }
            html += `</div>`;
        }

        // ── Marking scheme ──
        const steps = qd.marking_scheme?.steps;
        if (steps?.length) {
            html += `<div style="font-size: 16px; font-weight: 800; color: #6366f1; margin: 16px 0 8px; border-left: 4px solid #6366f1; padding-left: 10px;">評分標準</div>`;
            html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px;">`;
            html += `<tr style="background:#6366f1; color:white;"><th style="padding:8px 12px; text-align:left; border-radius:6px 0 0 0;">步驟</th><th style="padding:8px 12px; text-align:center; width:80px; border-radius:0 6px 0 0;">分數</th></tr>`;
            steps.forEach((s, i) => {
                const bg = i % 2 === 0 ? '#fafafe' : 'white';
                html += `<tr style="background:${bg};"><td style="padding:8px 12px; border:1px solid #e2e8f0;">${s.description || ''}</td><td style="padding:8px 12px; border:1px solid #e2e8f0; text-align:center; font-weight:700; color:#6366f1;">${s.marks}${s.markType || ''}</td></tr>`;
            });
            if (qd.marking_scheme.total_marks) {
                html += `<tr style="background:#f1f5f9; font-weight:700;"><td style="padding:8px 12px; border:1px solid #e2e8f0; text-align:right;">總分</td><td style="padding:8px 12px; border:1px solid #e2e8f0; text-align:center; color:#6366f1; font-size:15px;">${qd.marking_scheme.total_marks}</td></tr>`;
            }
            html += `</table>`;
        }

        return html;
    }

    /**
     * Render a container with HTML content, process MathJax + geometry figures,
     * then capture to a canvas via html2canvas.
     * @param {string} html - The inner HTML content
     * @param {Array} rows - Problem rows (for figure rendering)
     * @returns {HTMLCanvasElement}
     */
    static async _renderAndCapture(html, rows) {
        const container = document.createElement('div');
        container.id = 'pdf-render-container-' + Date.now();
        container.style.cssText = `
            position: fixed; left: -9999px; top: 0;
            width: 720px; padding: 40px 48px;
            background: white; font-family: 'Noto Sans TC', 'Inter', sans-serif;
            color: #1e293b; line-height: 1.8; font-size: 14px;
        `;
        container.innerHTML = html;
        document.body.appendChild(container);

        // ── Render LaTeX with MathJax (SVG output) ──
        if (window.MathJax?.typesetPromise) {
            try {
                // Clear MathJax's internal list so it processes fresh elements
                if (MathJax.startup?.document) {
                    MathJax.startup.document.clear();
                    MathJax.startup.document.updateDocument();
                }
                await MathJax.typesetPromise([container]);
            } catch (e) {
                console.warn('MathJax typesetting for PDF failed:', e);
            }
        }

        // Safety: hide any assistive/accessibility overlays that cause duplication
        container.querySelectorAll('mjx-assistive-mml, .MJX_Assistive_MathML, .MathJax_Preview').forEach(el => {
            el.style.display = 'none';
        });

        // Convert SVG elements to inline data so html2canvas can capture them
        container.querySelectorAll('svg').forEach(svg => {
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            // Ensure SVG has explicit dimensions for html2canvas
            if (!svg.getAttribute('width') && svg.getBoundingClientRect) {
                const rect = svg.getBoundingClientRect();
                if (rect.width) svg.setAttribute('width', rect.width + 'px');
                if (rect.height) svg.setAttribute('height', rect.height + 'px');
            }
        });

        // Wait for SVG rendering to stabilize
        await new Promise(r => setTimeout(r, 800));

        // ── Capture to canvas ──
        try {
            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                foreignObjectRendering: false
            });
            return canvas;
        } finally {
            container.remove();
        }
    }

    /**
     * Build a jsPDF from a canvas and save.
     */
    static _canvasToPdf(canvas, filename) {
        const { jsPDF } = window.jspdf;

        const imgData = canvas.toDataURL('image/png');
        const imgW = canvas.width;
        const imgH = canvas.height;

        const pageW = 210;
        const pageH = 297;
        const margin = 10;
        const contentW = pageW - margin * 2;
        const contentH = pageH - margin * 2;

        const ratio = contentW / imgW;
        const scaledH = imgH * ratio;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        if (scaledH <= contentH) {
            pdf.addImage(imgData, 'PNG', margin, margin, contentW, scaledH);
        } else {
            const pageCanvasH = contentH / ratio;
            let yOffset = 0;
            let pageNum = 0;

            while (yOffset < imgH) {
                if (pageNum > 0) pdf.addPage();

                const sliceH = Math.min(pageCanvasH, imgH - yOffset);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = imgW;
                sliceCanvas.height = sliceH;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);

                const sliceImg = sliceCanvas.toDataURL('image/png');
                const sliceScaledH = sliceH * ratio;
                pdf.addImage(sliceImg, 'PNG', margin, margin, contentW, sliceScaledH);

                yOffset += sliceH;
                pageNum++;
            }
        }

        pdf.save(filename);
    }

    /**
     * Export a single problem as a styled PDF.
     */
    static async _exportAsPdf(row) {
        if (!window.jspdf?.jsPDF) {
            throw new Error('jsPDF library not loaded');
        }

        const exportTime = new Date().toLocaleString('zh-HK');

        let html = '';
        // Header
        html += `
            <div style="border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
                <div style="font-size: 22px; font-weight: 800; color: #6366f1; margin-bottom: 2px;">Math Exploration Hub</div>
                <div style="font-size: 12px; color: #94a3b8; letter-spacing: 0.05em;">DSE 數學題目導出 · ${exportTime}</div>
            </div>
        `;

        html += this._buildProblemHtml(row);

        // Footer
        html += `
            <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
                Generated by Math Exploration Hub · COMP3122 Group 11 · ${new Date().getFullYear()}
            </div>
        `;

        const canvas = await this._renderAndCapture(html, [row]);
        const filename = `math-problem-${row.type}-${row.id.substring(0, 8)}.pdf`;
        this._canvasToPdf(canvas, filename);
    }

    /**
     * Export multiple problems into a single PDF.
     * @param {Array} rows - Array of problem rows
     */
    static async exportMultipleAsPdf(rows) {
        if (!window.jspdf?.jsPDF) {
            throw new Error('jsPDF library not loaded');
        }
        if (!rows.length) return;

        const exportTime = new Date().toLocaleString('zh-HK');

        let html = '';
        // Header
        html += `
            <div style="border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
                <div style="font-size: 22px; font-weight: 800; color: #6366f1; margin-bottom: 2px;">Math Exploration Hub</div>
                <div style="font-size: 12px; color: #94a3b8; letter-spacing: 0.05em;">DSE 數學題目合併導出 · ${exportTime} · 共 ${rows.length} 題</div>
            </div>
        `;

        rows.forEach((row, i) => {
            html += this._buildProblemHtml(row, i);
        });

        // Footer
        html += `
            <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
                Generated by Math Exploration Hub · COMP3122 Group 11 · ${new Date().getFullYear()} · 共 ${rows.length} 題
            </div>
        `;

        const canvas = await this._renderAndCapture(html, rows);
        const filename = `math-problems-batch-${rows.length}-${Date.now().toString(36)}.pdf`;
        this._canvasToPdf(canvas, filename);
    }

    /**
     * Export multiple problems into a single TXT file.
     * @param {Array} rows - Array of problem rows
     */
    static exportMultipleAsTxt(rows) {
        if (!rows.length) return;

        const lines = [];
        lines.push('═══════════════════════════════════════');
        lines.push('  Math Exploration Hub — 題目合併導出');
        lines.push(`  共 ${rows.length} 題`);
        lines.push(`  導出時間：${new Date().toLocaleString('zh-HK')}`);
        lines.push('═══════════════════════════════════════');
        lines.push('');

        rows.forEach((row, idx) => {
            const qd = row.question_data;
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push(`  第 ${idx + 1} 題`);
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push(`類型：${row.type === 'geometry' ? '幾何' : '代數'}`);
            lines.push(`課題：${row.topic}`);
            if (row.subtopic) lines.push(`子課題：${row.subtopic}`);
            lines.push(`難度：${row.difficulty}`);
            lines.push('');

            // Question text
            lines.push('── 題目敘述 ──');
            if (row.type === 'algebra') {
                const text = (qd.question?.text || '').replace(/\$/g, '');
                lines.push(text);
                (qd.question?.parts || []).forEach(p => {
                    lines.push(`${p.label} ${p.text.replace(/\$/g, '')} (${p.marks} 分)`);
                });
            } else {
                lines.push((qd.question_template?.text || '').replace(/\$/g, '').replace(/_\{\{.*?\}\}_/g, '[變數]'));
            }
            lines.push('');

            // Solution (algebra only)
            if (row.type === 'algebra' && qd.solution?.steps) {
                lines.push('── 解題步驟 ──');
                qd.solution.steps.forEach((s, i) => {
                    lines.push(`${i + 1}. ${s.description} → ${(s.expression || '').replace(/\$/g, '')}`);
                });
                if (qd.solution.final_answer) {
                    lines.push(`最終答案：${qd.solution.final_answer.replace(/\$/g, '')}`);
                }
                lines.push('');
            }

            // Marking scheme
            const steps = qd.marking_scheme?.steps;
            if (steps?.length) {
                lines.push('── 評分標準 ──');
                steps.forEach(s => {
                    lines.push(`• ${s.description}  [${s.marks}${s.markType || ''}]`);
                });
                if (qd.marking_scheme?.total_marks) {
                    lines.push(`總分：${qd.marking_scheme.total_marks}`);
                }
            }
            lines.push('');
        });

        lines.push('═══════════════════════════════════════');
        lines.push(`  Generated by Math Exploration Hub`);
        lines.push(`  COMP3122 Group 11 · ${new Date().getFullYear()}`);
        lines.push('═══════════════════════════════════════');

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const filename = `math-problems-batch-${rows.length}-${Date.now().toString(36)}.txt`;
        DBService._downloadBlob(blob, filename);
    }

    static _escHtml(text) {
        const el = document.createElement('div');
        el.textContent = String(text || '');
        return el.innerHTML;
    }

    static _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

}

window.DBService = DBService;


