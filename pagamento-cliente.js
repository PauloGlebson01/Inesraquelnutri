import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    updateDoc,
    doc,
    Timestamp,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// Obter parâmetros da URL
const urlParams = new URLSearchParams(window.location.search);
const agendamentoId = urlParams.get('agendamento');

console.log("ID do agendamento recebido:", agendamentoId);

let dadosAgendamento = null;
let metodoSelecionado = null;
let autenticado = false;

// Elementos
const clienteNome = document.getElementById('clienteNome');
const servicoNome = document.getElementById('servicoNome');
const profissionalNome = document.getElementById('profissionalNome');
const agendamentoData = document.getElementById('agendamentoData');
const agendamentoHorario = document.getElementById('agendamentoHorario');
const valorTotal = document.getElementById('valorTotal');
const btnConfirmar = document.getElementById('btnConfirmarPagamento');
const statusMessage = document.getElementById('statusMessage');
const pixSection = document.getElementById('pixSection');
const cartaoSection = document.getElementById('cartaoSection');

// Formatação de cartão
function formatCardNumber(value) {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const parts = v.match(/.{1,4}/g);
    return parts ? parts.join(' ') : v;
}

function formatExpiry(value) {
    const v = value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 3) {
        return `${v.substring(0, 2)}/${v.substring(2)}`;
    }
    return v;
}

const cardNumberInput = document.getElementById('cardNumber');
const cardExpiryInput = document.getElementById('cardExpiry');

if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
        e.target.value = formatCardNumber(e.target.value);
    });
}

if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
        e.target.value = formatExpiry(e.target.value);
    });
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function showMessage(msg, type) {
    if (!statusMessage) return;
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        if (statusMessage) statusMessage.style.display = 'none';
    }, 5000);
}

// Selecionar método de pagamento
document.querySelectorAll('.method-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        metodoSelecionado = card.dataset.method;
        
        // Esconder todas as seções
        if (pixSection) pixSection.style.display = 'none';
        if (cartaoSection) cartaoSection.style.display = 'none';
        
        // Mostrar seção correspondente
        if (metodoSelecionado === 'pix') {
            if (pixSection) pixSection.style.display = 'block';
            gerarPix();
        } else if (metodoSelecionado === 'cartao_credito' || metodoSelecionado === 'cartao_debito') {
            if (cartaoSection) cartaoSection.style.display = 'block';
            atualizarParcelas();
        }
        
        if (btnConfirmar) btnConfirmar.disabled = false;
    });
});

// Atualizar parcelas
function atualizarParcelas() {
    const valor = dadosAgendamento?.valor || 0;
    const parcelasSelect = document.getElementById('parcelas');
    if (!parcelasSelect) return;
    
    parcelasSelect.innerHTML = '';
    const maxParcelas = metodoSelecionado === 'cartao_credito' ? 12 : 1;
    
    for (let i = 1; i <= maxParcelas; i++) {
        const valorParcela = valor / i;
        parcelasSelect.innerHTML += `<option value="${i}">${i}x de ${formatarMoeda(valorParcela)}</option>`;
    }
}

// Gerar Pix
function gerarPix() {
    const valor = dadosAgendamento?.valor || 0;
    const pixKey = `00020126360014BR.GOV.BCB.PIX0114${Math.random().toString(36).substring(2, 15)}5204000053039865404${Math.floor(valor * 100).toString()}5802BR5925NutriEquilíbrio6009SAO PAULO62070503***6304`;
    
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '';
        try {
            new QRCode(qrcodeDiv, {
                text: pixKey,
                width: 180,
                height: 180,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error("Erro ao gerar QR Code:", e);
        }
    }
    
    const pixCode = document.getElementById('pixCode');
    if (pixCode) {
        pixCode.textContent = pixKey;
    }
}

// Copiar código Pix
const copyPixCodeBtn = document.getElementById('copyPixCode');
if (copyPixCodeBtn) {
    copyPixCodeBtn.addEventListener('click', () => {
        const code = document.getElementById('pixCode')?.textContent;
        if (code) {
            navigator.clipboard.writeText(code);
            showMessage("Código Pix copiado!", "success");
        }
    });
}

// Função para enviar WhatsApp de confirmação
function enviarWhatsAppConfirmacao() {
    if (!dadosAgendamento) return;
    
    const telefone = dadosAgendamento.telefone || dadosAgendamento.whatsapp;
    if (!telefone) {
        console.log("Telefone não encontrado");
        return;
    }
    
    const numeroLimpo = telefone.replace(/\D/g, "");
    if (numeroLimpo.length < 10) return;

    let num = numeroLimpo;
    if (num.length === 10) {
        num = num.substring(0, 2) + '9' + num.substring(2);
    }

    const metodoNome = {
        'pix': 'Pix',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'dinheiro': 'Dinheiro'
    }[metodoSelecionado] || metodoSelecionado;

    const parcelasSelect = document.getElementById('parcelas');
    const parcelas = parcelasSelect ? parseInt(parcelasSelect.value) : 1;
    const valorParcela = dadosAgendamento.valor / parcelas;

    const mensagem = `Olá ${dadosAgendamento.cliente}! 🥗✨\n\n` +
        `✅ *PAGAMENTO CONFIRMADO!*\n\n` +
        `Sua consulta foi *CONFIRMADA* com sucesso!\n\n` +
        `📝 *Detalhes da Consulta:*\n` +
        `• Plano: ${dadosAgendamento.servicoNome}\n` +
        `• Nutricionista: ${dadosAgendamento.profissional || 'Nossa equipe'}\n` +
        `• Data: ${dadosAgendamento.data}\n` +
        `• Horário: ${dadosAgendamento.horario}\n` +
        `• Valor: ${formatarMoeda(dadosAgendamento.valor)}\n\n` +
        `💳 *Forma de Pagamento:* ${metodoNome}\n` +
        `${parcelas > 1 ? `• ${parcelas}x de ${formatarMoeda(valorParcela)}\n` : ''}\n` +
        `📍 *Local:* NutriEquilíbrio - Consultório\n\n` +
        `⚠️ *Importante:*\n` +
        `⏰ Chegue com 10 minutos de antecedência.\n\n` +
        `⌛ Em caso de atraso, pode afetar os outros agendamentos\n\n` +
        `✨ *NutriEquilíbrio* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚`;

    const url = `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
    console.log("Abrindo WhatsApp:", url);
    window.open(url, '_blank');
}

// Carregar dados do agendamento
async function carregarDados() {
    console.log("Carregando dados do agendamento. ID:", agendamentoId);
    
    if (!agendamentoId) {
        showMessage("Nenhum agendamento encontrado. ID não informado.", "error");
        return;
    }
    
    if (!autenticado) {
        showMessage("Aguardando autenticação...", "info");
        return;
    }
    
    try {
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(agendamentosRef, where("__name__", "==", agendamentoId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            dadosAgendamento = querySnapshot.docs[0].data();
            dadosAgendamento.id = querySnapshot.docs[0].id;
            console.log("Agendamento encontrado:", dadosAgendamento);
            
            // Preencher os campos
            if (clienteNome) clienteNome.textContent = dadosAgendamento.cliente || dadosAgendamento.nome || '-';
            if (servicoNome) servicoNome.textContent = dadosAgendamento.servicoNome || dadosAgendamento.servico || '-';
            if (profissionalNome) profissionalNome.textContent = dadosAgendamento.profissional || 'Nutricionista não informado';
            if (agendamentoData) agendamentoData.textContent = dadosAgendamento.data || '-';
            if (agendamentoHorario) agendamentoHorario.textContent = dadosAgendamento.horario || '-';
            if (valorTotal) valorTotal.textContent = formatarMoeda(dadosAgendamento.valor || 0);
            
            if (btnConfirmar) btnConfirmar.disabled = true;
            
        } else {
            console.log("Agendamento não encontrado para o ID:", agendamentoId);
            showMessage("Agendamento não encontrado.", "error");
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        showMessage("Erro ao carregar dados do agendamento: " + error.message, "error");
    }
}

// Confirmar pagamento
async function confirmarPagamento() {
    if (!metodoSelecionado) {
        showMessage("Selecione um método de pagamento.", "error");
        return;
    }
    
    if (!dadosAgendamento) {
        showMessage("Dados do agendamento não encontrados.", "error");
        return;
    }
    
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando pagamento...';
    }
    
    try {
        const agendamentoRef = doc(db, "agendamentos", dadosAgendamento.id);
        await updateDoc(agendamentoRef, {
            status: "confirmado",
            pagamentoStatus: "pago",
            metodoPagamento: metodoSelecionado,
            parcelas: parseInt(document.getElementById('parcelas')?.value || 1),
            dataPagamento: new Date().toISOString().split('T')[0],
            atualizadoEm: Timestamp.now()
        });
        
        const pagamentosRef = collection(db, "pagamentos");
        await addDoc(pagamentosRef, {
            clienteId: null,
            servicoId: null,
            agendamentoId: dadosAgendamento.id,
            profissional: dadosAgendamento.profissional,
            valor: dadosAgendamento.valor,
            metodo: metodoSelecionado,
            parcelas: parseInt(document.getElementById('parcelas')?.value || 1),
            data: dadosAgendamento.data,
            status: 'pago',
            observacao: `Pagamento via ${metodoSelecionado} para consulta de ${dadosAgendamento.servicoNome} com ${dadosAgendamento.profissional}`,
            createdAt: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        });
        
        showMessage("✅ Pagamento realizado com sucesso!", "success");
        
        enviarWhatsAppConfirmacao();
        
        setTimeout(() => {
            window.location.href = 'agendamento-confirmado.html';
        }, 3000);
        
    } catch (error) {
        console.error("Erro ao processar pagamento:", error);
        showMessage("Erro ao processar pagamento. Tente novamente.", "error");
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pagamento';
        }
    }
}

if (btnConfirmar) {
    btnConfirmar.addEventListener('click', confirmarPagamento);
}

// Autenticação
signInAnonymously(auth).then(() => {
    autenticado = true;
    carregarDados();
}).catch((error) => {
    console.error("Erro na autenticação:", error);
    showMessage("Erro de autenticação.", "error");
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        autenticado = true;
        carregarDados();
    }
});