import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    updateDoc, 
    doc, 
    orderBy,
    Timestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ===========================
   CONFIGURAÇÃO FIREBASE
=========================== */
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
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos do DOM
const painel = document.getElementById('painel');
const logoutBtn = document.getElementById('logout');
const confirmadosDiv = document.getElementById('confirmados');
const concluidosDiv = document.getElementById('concluidos');
const canceladosDiv = document.getElementById('cancelados');
const countConfirmado = document.getElementById('countConfirmado');
const countConcluido = document.getElementById('countConcluido');
const countCancelado = document.getElementById('countCancelado');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnFiltrarPeriodo = document.getElementById('btnFiltrarPeriodo');
const btnLimparPeriodo = document.getElementById('btnLimparPeriodo');

let unsubscribe = null;

/* ===========================
   FUNÇÕES DE AUXÍLIO E UI
=========================== */

function formatarData(dataStr) {
    if (!dataStr) return 'Data não informada';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataParaMensagem(dataStr) {
    return formatarData(dataStr);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function gerarEstrelasTexto(nota) {
    let estrelas = '';
    for (let i = 1; i <= 5; i++) {
        estrelas += (i <= nota) ? '⭐' : '☆';
    }
    return estrelas;
}

function mostrarNotificacao(mensagem) {
    const notificacao = document.getElementById('notificacao');
    const sound = document.getElementById('notificationSound');
    if (notificacao) {
        notificacao.querySelector('span').textContent = mensagem;
        notificacao.style.display = 'flex';
        if (sound) sound.play().catch(() => {});
        setTimeout(() => notificacao.style.display = 'none', 5000);
    }
}

function atualizarContadores() {
    if (countConfirmado) countConfirmado.textContent = confirmadosDiv?.children.length || 0;
    if (countConcluido) countConcluido.textContent = concluidosDiv?.children.length || 0;
    if (countCancelado) countCancelado.textContent = canceladosDiv?.children.length || 0;
}

/* ===========================
   AÇÕES DE AGENDAMENTO
=========================== */

async function atualizarStatus(id, novoStatus, agendamento) {
    try {
        await updateDoc(doc(db, "agendamentos", id), {
            status: novoStatus,
            atualizadoEm: Timestamp.now()
        });
        
        if (novoStatus === 'confirmado') {
            enviarMensagemConfirmacao(agendamento);
            mostrarNotificacao(`✅ Consulta Confirmada!`);
        } else if (novoStatus === 'concluido') {
            await enviarMensagemConclusao({ id, ...agendamento });
            mostrarNotificacao(`🎉 Concluído! Link enviado.`);
        } else if (novoStatus === 'cancelado') {
            enviarMensagemCancelamento(agendamento);
            mostrarNotificacao(`❌ Cancelado! Cliente avisado.`);
        }
    } catch (error) {
        console.error("Erro ao atualizar:", error);
    }
}

function criarCardAgendamento(agendamento) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    
    const dataFormatada = formatarData(agendamento.data);
    const horario = agendamento.horario || '--:--';
    const servico = agendamento.servicoNome || agendamento.servico || 'Consulta';
    const cliente = agendamento.cliente || agendamento.nome || 'Cliente';
    const telefone = agendamento.telefone || agendamento.whatsapp || '';
    const profissional = agendamento.profissional || 'Nutricionista não informado';
    
    card.innerHTML = `
        <div class="appointment-header">
            <strong class="cliente-nome">${escapeHtml(cliente)}</strong>
            <span class="appointment-time">${escapeHtml(horario)}</span>
        </div>
        <div class="appointment-details">
            <div class="detail-item"><i class="fa-regular fa-calendar"></i><span>${dataFormatada}</span></div>
            <div class="detail-item"><i class="fa-solid fa-apple-whole"></i><span>${escapeHtml(servico)}</span></div>
            <div class="detail-item"><i class="fa-solid fa-user-nurse"></i><span>${escapeHtml(profissional)}</span></div>
            ${telefone ? `<div class="detail-item"><i class="fa-brands fa-whatsapp"></i><span>${escapeHtml(telefone)}</span></div>` : ''}
        </div>
        <div class="appointment-actions">
            ${agendamento.status === 'confirmado' ? `
                <button class="btn-status concluir"><i class="fa-solid fa-check"></i> Concluir</button>
                <button class="btn-status cancelar"><i class="fa-solid fa-xmark"></i> Cancelar</button>
            ` : ''}
        </div>
    `;
    
    const btnConcluir = card.querySelector('.concluir');
    const btnCancelar = card.querySelector('.cancelar');
    
    if (btnConcluir) btnConcluir.onclick = () => atualizarStatus(agendamento.id, 'concluido', agendamento);
    if (btnCancelar) btnCancelar.onclick = () => atualizarStatus(agendamento.id, 'cancelado', agendamento);
    
    return card;
}

/* ===========================
   WHATSAPP & AVALIAÇÕES
=========================== */

function enviarWhatsApp(telefone, mensagem) {
    const numeroLimpo = telefone.replace(/\D/g, "");
    if (numeroLimpo.length < 10) return false;
    
    let numeroFormatado = numeroLimpo;
    if (numeroFormatado.length === 10) {
        numeroFormatado = numeroFormatado.substring(0, 2) + '9' + numeroFormatado.substring(2);
    }
    
    const url = `https://wa.me/55${numeroFormatado}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
    return true;
}

async function salvarAvaliacaoInicial(id, cliente, servico) {
    try {
        await setDoc(doc(db, "avaliacoes", `${id}_avaliacao`), {
            cliente,
            servico,
            data: Timestamp.now(),
            status: 'pendente'
        }, { merge: true });
    } catch (e) {
        console.error("Erro ao salvar avaliação inicial:", e);
    }
}

function enviarMensagemConfirmacao(agendamento) {
    const telefone = agendamento.telefone || agendamento.whatsapp;
    if (!telefone) return false;

    const cliente = agendamento.cliente || agendamento.nome || 'cliente';
    const servico = agendamento.servicoNome || agendamento.servico || 'Consulta';
    const profissional = agendamento.profissional || 'nutricionista';
    const dataFormatada = formatarDataParaMensagem(agendamento.data);
    const horario = agendamento.horario || '--:--';
    const valor = agendamento.valor ? `R$ ${parseFloat(agendamento.valor).toFixed(2)}` : 'A combinar';

    const mensagem = `Olá ${cliente}! 🥗✨\n\n` +
        `Sua consulta foi *CONFIRMADA* com sucesso!\n\n` +
        `📝 *Detalhes:*\n` +
        `• Plano: ${servico}\n` +
        `• Nutricionista: ${profissional}\n` +
        `• Data: ${dataFormatada}\n` +
        `• Horário: ${horario}\n` +
        `• Valor: ${valor}\n\n` +
        `📍 *Local:* NutriEquilíbrio - Consultório\n\n` +
        `⚠️ *Importante:*\n\n` +
        `⏰ Chegue com 10 minutos de antecedência.\n\n` +
        `⌛ Em caso de atraso, pode afetar os outros agendamentos\n\n` +
        `✨ *NutriEquilíbrio* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚`;

    return enviarWhatsApp(telefone, mensagem);
}

async function enviarMensagemConclusao(agendamento) {
    const telefone = agendamento.telefone || agendamento.whatsapp;
    if (!telefone) return false;
    
    const cliente = agendamento.cliente || agendamento.nome || 'cliente';
    const servico = agendamento.servicoNome || agendamento.servico || 'consulta realizada';
    const profissional = agendamento.profissional || 'nutricionista';
    const agendamentoId = agendamento.id;
    
    await salvarAvaliacaoInicial(agendamentoId, cliente, servico);
    
    const notas = [1, 2, 3, 4, 5];
    const linksAvaliacao = [];
    const baseUrl = window.location.origin;
    
    for (let nota of notas) {
        const estrelas = gerarEstrelasTexto(nota);
        const link = `${baseUrl}/avaliacao.html?id=${agendamentoId}_avaliacao&cliente=${encodeURIComponent(cliente)}&servico=${encodeURIComponent(servico)}&nota=${nota}`;
        linksAvaliacao.push(`${estrelas} - ${link}`);
    }
    
    const mensagem = `Olá ${cliente}! 💚✨\n\n` +
        `Sua consulta foi *CONCLUÍDA* com sucesso!\n\n` +
        `📋 *Plano realizado:* ${servico}\n` +
        `👩‍⚕️ *Nutricionista:* ${profissional}\n\n` +
        `Agradecemos pela preferência!\n\n` +
        `⭐ *Avalie nosso atendimento* ⭐\n\n` +
        `${linksAvaliacao.join('\n\n')}\n\n` +
        `✨ *NutriEquilíbrio* ✨\n` +
        `Sua saúde em primeiro lugar 💚`;

    return enviarWhatsApp(telefone, mensagem);
}

function enviarMensagemCancelamento(agendamento) {
    const telefone = agendamento.telefone || agendamento.whatsapp;
    if (!telefone) return false;
    
    const cliente = agendamento.cliente || agendamento.nome || 'cliente';
    const servico = agendamento.servicoNome || agendamento.servico || 'consulta agendada';
    const profissional = agendamento.profissional || 'nutricionista';
    const dataFormatada = formatarDataParaMensagem(agendamento.data);
    
    const mensagem = `Olá ${cliente}! 🥗\n\n` +
        `Informamos que a sua consulta para *${servico}* com *${profissional}* no dia *${dataFormatada}* está sendo *CANCELADA*.\n\n` +
        `Caso tenha interesse em reagendar, acesse nosso sistema de agendamento!\n\n` +
        `✨ *NutriEquilíbrio* ✨\n` +
        `Estamos à disposição para atendê-lo(a) 💚`;
    
    return enviarWhatsApp(telefone, mensagem);
}

/* ===========================
    CORE: ESCUTA EM TEMPO REAL
=========================== */

function iniciarListener() {
    if (typeof unsubscribe === 'function') unsubscribe();

    const dInicioInput = dataInicio ? dataInicio.value : '';
    const dFimInput = dataFim ? dataFim.value : '';

    let dInicio, dFim;

    if (!dInicioInput && !dFimInput) {
        const hoje = new Date();
        const offset = hoje.getTimezoneOffset() * 60000;
        const dataLocal = new Date(hoje - offset);
        dInicio = dataLocal.toISOString().split('T')[0];
        dFim = dInicio;
        console.log("📅 Carregamento automático: Filtrando apenas HOJE:", dInicio);
    } else {
        dInicio = dInicioInput;
        dFim = dFimInput;
        console.log("🔍 Filtro manual ativado:", dInicio, "até", dFim);
    }

    const q = query(
        collection(db, "agendamentos"), 
        where("data", ">=", dInicio), 
        where("data", "<=", dFim), 
        orderBy("data", "asc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        if (confirmadosDiv) confirmadosDiv.innerHTML = '';
        if (concluidosDiv) concluidosDiv.innerHTML = '';
        if (canceladosDiv) canceladosDiv.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = { id: docSnap.id, ...docSnap.data() };
            const card = criarCardAgendamento(data);

            if (data.status === 'confirmado') confirmadosDiv?.appendChild(card);
            else if (data.status === 'concluido' || data.status === 'realizado') concluidosDiv?.appendChild(card);
            else if (data.status === 'cancelado') canceladosDiv?.appendChild(card);
        });

        if (typeof atualizarContadores === 'function') atualizarContadores();
    }, (error) => {
        console.error("❌ ERRO NO FIRESTORE:", error);
        if (error.code === 'failed-precondition') {
            alert("O filtro precisa de um índice. Abra o console do navegador (F12) e clique no link azul para criá-lo.");
        }
    });
}

/* ===========================
    INICIALIZAÇÃO E EVENTOS
=========================== */

document.addEventListener('DOMContentLoaded', () => {
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    
    iniciarListener();
});

if (btnFiltrarPeriodo) {
    btnFiltrarPeriodo.onclick = () => {
        if (!dataInicio.value || !dataFim.value) {
            alert("Escolha a data de início e fim.");
            return;
        }
        iniciarListener();
    };
}

if (btnLimparPeriodo) {
    btnLimparPeriodo.onclick = () => {
        dataInicio.value = ''; 
        dataFim.value = '';
        iniciarListener();
    };
}