import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    getDocs, 
    where, 
    orderBy, 
    addDoc,
    onSnapshot,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmodWGagSV-yco1FQ1-U81Xhd-y4NsE3s",
  authDomain: "ines-raquel-softclick-nutri.firebaseapp.com",
  projectId: "ines-raquel-softclick-nutri",
  storageBucket: "ines-raquel-softclick-nutri.firebasestorage.app",
  messagingSenderId: "284677746064",
  appId: "1:284677746064:web:4daac55dd6b2491dbd9715",
  measurementId: "G-5C0YC43V2G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("Firebase carregado e módulo ativo!");

// Autenticação anônima automática
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Autenticado com sucesso!");
        monitorarHistorico();
    }
});

// FUNÇÕES DE EXPORTAÇÃO
window.exportarExcelAgendamentos = async () => {
    console.log("Botão Excel Agendamentos clicado");
    const inicio = document.getElementById('excelDataInicio').value;
    const fim = document.getElementById('excelDataFim').value;
    
    if (!inicio || !fim) {
        mostrarNotificacao("Selecione o período!", "erro");
        return;
    }

    try {
        const q = query(
            collection(db, "agendamentos"), 
            where("data", ">=", inicio), 
            where("data", "<=", fim)
        );
        const snap = await getDocs(q);
        const dados = [];
        snap.forEach(doc => {
            const data = doc.data();
            dados.push({
                'Data': data.data || '',
                'Paciente': data.cliente || data.nome || '',
                'Telefone': data.telefone || data.whatsapp || '',
                'Plano': data.servicoNome || data.servico || '',
                'Horário': data.horario || '',
                'Valor': `R$ ${(data.valor || 0).toFixed(2)}`,
                'Status': data.status || ''
            });
        });
        
        if (dados.length === 0) {
            mostrarNotificacao("Nenhum agendamento encontrado no período.", "erro");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
        const nomeArquivo = `Agendamentos_${inicio}_a_${fim}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);

        await registrarExportacao("Agendamentos", "Excel", dados, nomeArquivo);
        mostrarNotificacao(`Agendamentos exportados com sucesso!`, "sucesso");
    } catch (e) { 
        console.error("Erro no Firebase:", e); 
        mostrarNotificacao("Erro ao acessar o banco de dados.", "erro"); 
    }
};

window.exportarExcelPacientes = async () => {
    try {
        const snap = await getDocs(collection(db, "clientes"));
        const dados = [];
        snap.forEach(doc => {
            const data = doc.data();
            
            let dataCadastro = '-';
            if (data.createdAt) {
                if (data.createdAt.toDate) {
                    const date = data.createdAt.toDate();
                    dataCadastro = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                } else if (data.createdAt.seconds) {
                    const date = new Date(data.createdAt.seconds * 1000);
                    dataCadastro = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                } else if (typeof data.createdAt === 'string') {
                    dataCadastro = data.createdAt;
                }
            } else if (data.dataCadastro) {
                dataCadastro = data.dataCadastro;
            }
            
            dados.push({
                'Nome do Paciente': data.nome || data.cliente || '',
                'Contato': data.telefone || data.whatsapp || '',
                'Data de Cadastro': dataCadastro
            });
        });
        
        if (dados.length === 0) {
            mostrarNotificacao("Nenhum paciente cadastrado.", "erro");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
        const nomeArquivo = `Pacientes_NutriEquilibrio.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);

        await registrarExportacao("Pacientes", "Excel", dados, nomeArquivo);
        mostrarNotificacao("Pacientes exportados com sucesso!", "sucesso");
    } catch (e) { 
        console.error(e);
        mostrarNotificacao("Erro ao exportar pacientes.", "erro"); 
    }
};

window.exportarExcelFinanceiro = async () => {
    try {
        const snap = await getDocs(collection(db, "agendamentos"));
        const dados = [];
        let totalFaturamento = 0;
        let totalAgendamentos = 0;
        let totalConcluidos = 0;
        let totalCancelados = 0;
        let totalPendentes = 0;
        
        snap.forEach(doc => {
            const data = doc.data();
            const valor = data.valor || 0;
            
            if (data.status === 'concluido') {
                totalFaturamento += valor;
                totalConcluidos++;
            } else if (data.status === 'cancelado') {
                totalCancelados++;
            } else if (data.status === 'confirmado') {
                totalPendentes++;
            }
            totalAgendamentos++;
            
            dados.push({
                'Data': data.data || '',
                'Paciente': data.cliente || data.nome || '',
                'Plano': data.servicoNome || data.servico || '',
                'Valor': `R$ ${valor.toFixed(2)}`,
                'Status': data.status || ''
            });
        });
        
        // Adicionar linha de total
        dados.push({
            'Data': 'TOTAL',
            'Paciente': '',
            'Plano': '',
            'Valor': `R$ ${totalFaturamento.toFixed(2)}`,
            'Status': ''
        });
        
        // Adicionar resumo
        dados.push({
            'Data': 'RESUMO',
            'Paciente': 'Total de Agendamentos',
            'Plano': `${totalAgendamentos}`,
            'Valor': '',
            'Status': ''
        });
        dados.push({
            'Data': 'RESUMO',
            'Paciente': 'Concluídos',
            'Plano': `${totalConcluidos}`,
            'Valor': `R$ ${totalFaturamento.toFixed(2)}`,
            'Status': ''
        });
        dados.push({
            'Data': 'RESUMO',
            'Paciente': 'Cancelados',
            'Plano': `${totalCancelados}`,
            'Valor': '',
            'Status': ''
        });
        dados.push({
            'Data': 'RESUMO',
            'Paciente': 'Pendentes',
            'Plano': `${totalPendentes}`,
            'Valor': '',
            'Status': ''
        });

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
        const nomeArquivo = `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);

        await registrarExportacao("Financeiro", "Excel", dados, nomeArquivo);
        mostrarNotificacao("Relatório financeiro exportado!", "sucesso");
    } catch (e) { 
        console.error(e);
        mostrarNotificacao("Erro ao gerar financeiro.", "erro"); 
    }
};

window.exportarPDFAgendamentos = async () => {
    const inicio = document.getElementById('pdfDataInicio').value;
    const fim = document.getElementById('pdfDataFim').value;
    if (!inicio || !fim) {
        mostrarNotificacao("Selecione as datas!", "erro");
        return;
    }

    try {
        const q = query(
            collection(db, "agendamentos"), 
            where("data", ">=", inicio), 
            where("data", "<=", fim)
        );
        const snap = await getDocs(q);
        const dados = [];
        let totalValor = 0;
        
        snap.forEach(doc => {
            const data = doc.data();
            const valor = data.valor || 0;
            totalValor += valor;
            dados.push([
                data.data || '',
                data.cliente || data.nome || '',
                data.servicoNome || data.servico || '',
                data.horario || '',
                `R$ ${valor.toFixed(2)}`,
                data.status || ''
            ]);
        });

        if (dados.length === 0) {
            mostrarNotificacao("Nenhum agendamento encontrado.", "erro");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.setTextColor(16, 185, 129);
        doc.text("Relatório de Agendamentos", 14, 20);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`Período: ${inicio} a ${fim}`, 14, 28);
        doc.text(`Data de emissão: ${new Date().toLocaleString()}`, 14, 34);
        
        doc.autoTable({ 
            head: [['Data', 'Paciente', 'Plano', 'Horário', 'Valor', 'Status']], 
            body: dados,
            startY: 40,
            headStyles: { fillColor: [16, 185, 129] },
            alternateRowStyles: { fillColor: [30, 41, 59] },
            styles: { textColor: [255, 255, 255], fontSize: 8 },
            margin: { left: 10, right: 10 }
        });
        
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129);
        doc.text(`Total do período: R$ ${totalValor.toFixed(2)}`, 14, finalY);
        
        const nomeArquivo = `Relatorio_Agendamentos_${inicio}_a_${fim}.pdf`;
        doc.save(nomeArquivo);

        const dadosParaSalvar = {
            dados: dados,
            totalValor: totalValor,
            inicio: inicio,
            fim: fim
        };

        await registrarExportacao("Agendamentos", "PDF", dadosParaSalvar, nomeArquivo);
        mostrarNotificacao("PDF gerado com sucesso!", "sucesso");
    } catch (e) { 
        console.error(e);
        mostrarNotificacao("Erro ao gerar PDF.", "erro"); 
    }
};

window.exportarPDFPacientes = async () => {
    try {
        const snap = await getDocs(collection(db, "clientes"));
        const dados = [];
        
        snap.forEach(doc => {
            const data = doc.data();
            
            let dataCadastro = '-';
            if (data.createdAt) {
                if (data.createdAt.toDate) {
                    const date = data.createdAt.toDate();
                    dataCadastro = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                } else if (data.createdAt.seconds) {
                    const date = new Date(data.createdAt.seconds * 1000);
                    dataCadastro = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                } else if (typeof data.createdAt === 'string') {
                    dataCadastro = data.createdAt;
                }
            } else if (data.dataCadastro) {
                dataCadastro = data.dataCadastro;
            }
            
            dados.push([
                data.nome || data.cliente || '',
                data.telefone || data.whatsapp || '',
                dataCadastro
            ]);
        });

        if (dados.length === 0) {
            mostrarNotificacao("Nenhum paciente cadastrado.", "erro");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.setTextColor(16, 185, 129);
        doc.text("Lista de Pacientes", 14, 20);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`Data de emissão: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Total de pacientes: ${dados.length}`, 14, 34);

        doc.autoTable({ 
            head: [['Nome do Paciente', 'Contato', 'Data de Cadastro']], 
            body: dados,
            startY: 40,
            headStyles: { fillColor: [16, 185, 129] },
            alternateRowStyles: { fillColor: [30, 41, 59] },
            styles: { textColor: [255, 255, 255], fontSize: 9 }
        });
        
        const nomeArquivo = `Pacientes_NutriEquilibrio_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(nomeArquivo);

        const dadosParaSalvar = {
            dados: dados,
            totalPacientes: dados.length
        };

        await registrarExportacao("Pacientes", "PDF", dadosParaSalvar, nomeArquivo);
        mostrarNotificacao("PDF de pacientes gerado!", "sucesso");
    } catch (e) { 
        console.error(e);
        mostrarNotificacao("Erro ao gerar PDF.", "erro"); 
    }
};

// NOVA FUNÇÃO: Exportar PDF Financeiro
window.exportarPDFFinanceiro = async () => {
    try {
        mostrarNotificacao("Gerando relatório financeiro...", "sucesso");
        
        const snap = await getDocs(collection(db, "agendamentos"));
        
        let totalFaturamento = 0;
        let totalAgendamentos = 0;
        let totalConcluidos = 0;
        let totalCancelados = 0;
        let totalPendentes = 0;
        
        // Agrupamento por mês
        const faturamentoPorMes = {};
        const planosPorNome = {};
        
        const dadosDetalhados = [];
        
        snap.forEach(doc => {
            const data = doc.data();
            const valor = data.valor || 0;
            const status = data.status || '';
            const dataAgendamento = data.data;
            const planoNome = data.servicoNome || data.servico || 'Outros';
            
            totalAgendamentos++;
            
            if (status === 'concluido') {
                totalFaturamento += valor;
                totalConcluidos++;
                
                // Agrupamento por mês
                if (dataAgendamento) {
                    const mes = dataAgendamento.substring(0, 7); // YYYY-MM
                    faturamentoPorMes[mes] = (faturamentoPorMes[mes] || 0) + valor;
                }
            } else if (status === 'cancelado') {
                totalCancelados++;
            } else if (status === 'confirmado') {
                totalPendentes++;
            }
            
            // Contagem por plano
            planosPorNome[planoNome] = (planosPorNome[planoNome] || 0) + 1;
            
            dadosDetalhados.push([
                data.data || '',
                data.cliente || data.nome || '',
                planoNome,
                `R$ ${valor.toFixed(2)}`,
                status === 'concluido' ? '✓ Concluído' : status === 'cancelado' ? '✗ Cancelado' : '⏳ Pendente'
            ]);
        });
        
        // Calcular ticket médio
        const ticketMedio = totalConcluidos > 0 ? totalFaturamento / totalConcluidos : 0;
        
        // Ordenar meses
        const mesesOrdenados = Object.keys(faturamentoPorMes).sort();
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(18);
        doc.setTextColor(16, 185, 129);
        doc.text("Relatório Financeiro - NutriEquilíbrio", 14, 20);
        doc.setTextColor(255, 255, 255);
        
        // Data de emissão
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Data de emissão: ${new Date().toLocaleString()}`, 14, 28);
        
        // Cards de resumo
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text("📊 RESUMO GERAL", 14, 40);
        
        doc.setFontSize(10);
        doc.text(`Total de Agendamentos: ${totalAgendamentos}`, 14, 48);
        doc.text(`✓ Concluídos: ${totalConcluidos}`, 14, 55);
        doc.text(`⏳ Pendentes: ${totalPendentes}`, 14, 62);
        doc.text(`✗ Cancelados: ${totalCancelados}`, 14, 69);
        doc.text(`💰 Faturamento Total: R$ ${totalFaturamento.toFixed(2)}`, 14, 76);
        doc.text(`🎫 Ticket Médio: R$ ${ticketMedio.toFixed(2)}`, 14, 83);
        
        let currentY = 95;
        
        // Tabela de faturamento por mês
        if (mesesOrdenados.length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(16, 185, 129);
            doc.text("📈 FATURAMENTO POR MÊS", 14, currentY);
            currentY += 8;
            
            const dadosMensais = mesesOrdenados.map(mes => {
                const [ano, mesNum] = mes.split('-');
                const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                const mesNome = `${mesesNomes[parseInt(mesNum) - 1]}/${ano}`;
                return [mesNome, `R$ ${faturamentoPorMes[mes].toFixed(2)}`];
            });
            
            doc.autoTable({
                head: [['Mês', 'Faturamento']],
                body: dadosMensais,
                startY: currentY,
                headStyles: { fillColor: [16, 185, 129] },
                alternateRowStyles: { fillColor: [30, 41, 59] },
                styles: { textColor: [255, 255, 255], fontSize: 9 }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        }
        
        // Tabela de planos mais realizados
        const planosOrdenados = Object.entries(planosPorNome)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        if (planosOrdenados.length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(16, 185, 129);
            doc.text("🏆 PLANOS MAIS REALIZADOS", 14, currentY);
            currentY += 8;
            
            const dadosPlanos = planosOrdenados.map(([nome, qtd]) => [nome, qtd]);
            
            doc.autoTable({
                head: [['Plano', 'Quantidade']],
                body: dadosPlanos,
                startY: currentY,
                headStyles: { fillColor: [16, 185, 129] },
                alternateRowStyles: { fillColor: [30, 41, 59] },
                styles: { textColor: [255, 255, 255], fontSize: 9 }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        }
        
        // Tabela de agendamentos detalhados (limitado para não estourar página)
        if (dadosDetalhados.length > 0) {
            doc.addPage();
            doc.setFontSize(11);
            doc.setTextColor(16, 185, 129);
            doc.text("📋 DETALHAMENTO DOS AGENDAMENTOS", 14, 20);
            
            doc.autoTable({
                head: [['Data', 'Paciente', 'Plano', 'Valor', 'Status']],
                body: dadosDetalhados.slice(0, 30),
                startY: 28,
                headStyles: { fillColor: [16, 185, 129] },
                alternateRowStyles: { fillColor: [30, 41, 59] },
                styles: { textColor: [255, 255, 255], fontSize: 8 },
                margin: { left: 10, right: 10 }
            });
            
            if (dadosDetalhados.length > 30) {
                const finalY = doc.lastAutoTable.finalY + 5;
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`* Exibindo os 30 primeiros registros de um total de ${dadosDetalhados.length}`, 14, finalY);
            }
        }
        
        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(`NutriEquilíbrio - Relatório Financeiro - Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
        }
        
        const nomeArquivo = `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(nomeArquivo);
        
        const dadosParaSalvar = {
            totalFaturamento: totalFaturamento,
            totalAgendamentos: totalAgendamentos,
            totalConcluidos: totalConcluidos,
            totalCancelados: totalCancelados,
            totalPendentes: totalPendentes,
            ticketMedio: ticketMedio,
            faturamentoPorMes: faturamentoPorMes,
            planosPorNome: planosPorNome
        };
        
        await registrarExportacao("Financeiro", "PDF", dadosParaSalvar, nomeArquivo);
        mostrarNotificacao("Relatório financeiro PDF gerado com sucesso!", "sucesso");
        
    } catch (e) {
        console.error("Erro ao gerar PDF financeiro:", e);
        mostrarNotificacao("Erro ao gerar relatório financeiro.", "erro");
    }
};

// Função para baixar novamente
window.baixarNovamente = async (exportacaoId) => {
    try {
        const exportacaoSnap = await getDocs(query(collection(db, "historico_exportacoes"), where("__name__", "==", exportacaoId)));
        
        if (exportacaoSnap.empty) {
            mostrarNotificacao("Exportação não encontrada.", "erro");
            return;
        }
        
        const exportacao = exportacaoSnap.docs[0].data();
        
        if (!exportacao.dadosExportados) {
            mostrarNotificacao("Esta exportação foi gerada antes da funcionalidade de re-download. Gere uma nova exportação.", "erro");
            return;
        }
        
        if (exportacao.formato === "Excel") {
            let dadosParaExportar = exportacao.dadosExportados;
            const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, exportacao.tipo);
            XLSX.writeFile(wb, exportacao.nomeArquivo || `${exportacao.tipo}_${Date.now()}.xlsx`);
            mostrarNotificacao(`Arquivo baixado novamente!`, "sucesso");
        } else if (exportacao.formato === "PDF") {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const dadosExportados = exportacao.dadosExportados;
            
            if (exportacao.tipo === "Pacientes") {
                const dados = dadosExportados.dados || dadosExportados;
                doc.setFontSize(16);
                doc.setTextColor(16, 185, 129);
                doc.text("Lista de Pacientes", 14, 20);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.text(`Data de re-emissão: ${new Date().toLocaleString()}`, 14, 28);
                doc.text(`Total de pacientes: ${dados.length}`, 14, 34);
                doc.autoTable({ 
                    head: [['Nome do Paciente', 'Contato', 'Data de Cadastro']], 
                    body: dados,
                    startY: 40,
                    headStyles: { fillColor: [16, 185, 129] },
                    alternateRowStyles: { fillColor: [30, 41, 59] },
                    styles: { textColor: [255, 255, 255], fontSize: 9 }
                });
                doc.save(exportacao.nomeArquivo || `Pacientes_${Date.now()}.pdf`);
                mostrarNotificacao(`Arquivo baixado novamente!`, "sucesso");
            } else if (exportacao.tipo === "Agendamentos") {
                const dados = dadosExportados.dados || dadosExportados;
                const totalValor = dadosExportados.totalValor || 0;
                const inicio = dadosExportados.inicio || '-';
                const fim = dadosExportados.fim || '-';
                doc.setFontSize(16);
                doc.setTextColor(16, 185, 129);
                doc.text("Relatório de Agendamentos", 14, 20);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.text(`Período: ${inicio} a ${fim}`, 14, 28);
                doc.text(`Data de re-emissão: ${new Date().toLocaleString()}`, 14, 34);
                doc.autoTable({ 
                    head: [['Data', 'Paciente', 'Plano', 'Horário', 'Valor', 'Status']], 
                    body: dados,
                    startY: 40,
                    headStyles: { fillColor: [16, 185, 129] },
                    alternateRowStyles: { fillColor: [30, 41, 59] },
                    styles: { textColor: [255, 255, 255], fontSize: 8 }
                });
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(12);
                doc.setTextColor(16, 185, 129);
                doc.text(`Total do período: R$ ${totalValor.toFixed(2)}`, 14, finalY);
                doc.save(exportacao.nomeArquivo || `Agendamentos_${Date.now()}.pdf`);
                mostrarNotificacao(`Arquivo baixado novamente!`, "sucesso");
            } else if (exportacao.tipo === "Financeiro") {
                const dados = dadosExportados;
                doc.setFontSize(16);
                doc.setTextColor(16, 185, 129);
                doc.text("Relatório Financeiro - NutriEquilíbrio", 14, 20);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.text(`Data de re-emissão: ${new Date().toLocaleString()}`, 14, 28);
                doc.text(`Faturamento Total: R$ ${(dados.totalFaturamento || 0).toFixed(2)}`, 14, 36);
                doc.text(`Ticket Médio: R$ ${(dados.ticketMedio || 0).toFixed(2)}`, 14, 43);
                doc.text(`Total de Agendamentos: ${dados.totalAgendamentos || 0}`, 14, 50);
                doc.text(`Concluídos: ${dados.totalConcluidos || 0}`, 14, 57);
                doc.text(`Cancelados: ${dados.totalCancelados || 0}`, 14, 64);
                doc.text(`Pendentes: ${dados.totalPendentes || 0}`, 14, 71);
                doc.save(exportacao.nomeArquivo || `Financeiro_${Date.now()}.pdf`);
                mostrarNotificacao(`Arquivo baixado novamente!`, "sucesso");
            }
        }
    } catch (e) {
        console.error("Erro ao baixar novamente:", e);
        mostrarNotificacao("Erro ao baixar o arquivo.", "erro");
    }
};

// Excluir exportação
window.excluirExportacao = async (exportacaoId) => {
    if (confirm("Tem certeza que deseja excluir este registro do histórico?")) {
        try {
            await deleteDoc(doc(db, "historico_exportacoes", exportacaoId));
            mostrarNotificacao("Exportação excluída do histórico!", "sucesso");
        } catch (e) {
            console.error("Erro ao excluir:", e);
            mostrarNotificacao("Erro ao excluir o registro.", "erro");
        }
    }
};

// FUNÇÕES AUXILIARES
async function registrarExportacao(tipo, formato, dadosExportados, nomeArquivo) {
    try {
        await addDoc(collection(db, "historico_exportacoes"), {
            data: new Date().toISOString(),
            tipo: tipo,
            formato: formato,
            status: "Sucesso",
            usuario: "admin",
            nomeArquivo: nomeArquivo,
            dadosExportados: dadosExportados
        });
    } catch (e) { 
        console.error("Erro ao registrar exportação:", e); 
    }
}

function monitorarHistorico() {
    const q = query(collection(db, "historico_exportacoes"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('historyList');
        if (!list) return;
        list.innerHTML = "";
        if (snapshot.empty) {
            list.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma exportação realizada</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const item = doc.data();
            list.innerHTML += `
                <tr>
                    <td>${new Date(item.data).toLocaleString()}</td>
                    <td>${item.tipo || '-'}</td>
                    <td><strong>${item.formato || '-'}</strong></td>
                    <td><span class="status-badge status-success">Concluído</span></td>
                    <td class="action-buttons">
                        <button class="action-btn" onclick="baixarNovamente('${doc.id}')" title="Baixar novamente">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button class="action-btn" onclick="excluirExportacao('${doc.id}')" title="Excluir" style="color: #ef4444;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    });
}

function mostrarNotificacao(msg, tipo = "sucesso") {
    const toast = document.getElementById('notificacao');
    const msgEl = document.getElementById('notificacaoMsg');
    
    if (toast && msgEl) {
        if (tipo === "sucesso") {
            toast.style.background = "linear-gradient(135deg, #10b981, #059669)";
        } else {
            toast.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
        }
        
        msgEl.innerText = msg;
        toast.style.display = 'flex';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

window.visualizarExportacao = (id) => {
    mostrarNotificacao(`Exportação #${id.slice(0,8)} visualizada`, "sucesso");
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const painel = document.getElementById('painel');
    if (painel) painel.style.display = 'flex';
});