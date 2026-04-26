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

/* ===========================
   CONFIGURAÇÃO FIREBASE
=========================== */
const firebaseConfig = {
  apiKey: "AIzaSyAtpeuw5e9IgctiZh2UROXMEk-10BcUHAI",
  authDomain: "nutri-agendamentos.firebaseapp.com",
  projectId: "nutri-agendamentos",
  storageBucket: "nutri-agendamentos.firebasestorage.app",
  messagingSenderId: "192742643803",
  appId: "1:192742643803:web:4cf93b5fdcbfa8949d077e",
  measurementId: "G-CNQ26DG1N0"
};

/* ===========================
   CONFIGURAÇÃO EMAILJS
=========================== */
const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'DZF356b2qE9A0zVlS',
    SERVICE_ID: 'service_3dpf5ng',
    TEMPLATE_ID: 'template_xixo35p'  // Seu template ID para confirmação
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Inicializar EmailJS
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    console.log("✅ EmailJS inicializado");
}

// Obter parâmetros da URL
const urlParams = new URLSearchParams(window.location.search);
const agendamentoId = urlParams.get('agendamento');

console.log("ID do agendamento recebido:", agendamentoId);

let dadosAgendamento = null;
let metodoSelecionado = null;
let autenticado = false;

// CHAVE PIX FIXA
const CHAVE_PIX_FIXA = "(83) 99186-3520";
const NOME_RECEBEDOR = "INES RAQUEL";
const CIDADE = "JOAO PESSOA";

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
        
        if (pixSection) pixSection.style.display = 'none';
        if (cartaoSection) cartaoSection.style.display = 'none';
        
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

function gerarPayloadPix(chave, nome, cidade, valor) {
    const nomeLimpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const cidadeLimpa = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const valorCentavos = Math.round(valor * 100).toString();
    
    let payload = "";
    payload += "000201";
    
    const gui = "0014BR.GOV.BCB.PIX";
    const chaveFormatada = "01" + chave.length.toString().padStart(2, '0') + chave;
    const merchantAccount = gui + chaveFormatada;
    payload += "26" + merchantAccount.length.toString().padStart(2, '0') + merchantAccount;
    
    payload += "52040000";
    payload += "5303986";
    
    if (valorCentavos !== "0") {
        payload += "54" + valorCentavos.length.toString().padStart(2, '0') + valorCentavos;
    }
    
    payload += "5802BR";
    payload += "59" + nomeLimpo.length.toString().padStart(2, '0') + nomeLimpo;
    payload += "60" + cidadeLimpa.length.toString().padStart(2, '0') + cidadeLimpa;
    
    const txid = "***";
    payload += "62" + "05" + txid.length.toString().padStart(2, '0') + txid;
    payload += "6304";
    
    function calcularCRC16(payload) {
        let crc = 0xFFFF;
        for (let i = 0; i < payload.length; i++) {
            crc ^= payload.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
            }
        }
        return crc & 0xFFFF;
    }
    
    const crc = calcularCRC16(payload);
    const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
    
    return payload.slice(0, -4) + crcHex;
}

function gerarPix() {
    const valor = dadosAgendamento?.valor || 0;
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '<div style="text-align:center; color:white;">Gerando QR Code...</div>';
    }
    
    setTimeout(() => {
        try {
            const payloadPix = gerarPayloadPix(CHAVE_PIX_FIXA, NOME_RECEBEDOR, CIDADE, valor);
            
            if (qrcodeDiv) {
                qrcodeDiv.innerHTML = '';
                
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrcodeDiv, {
                        text: payloadPix,
                        width: 200,
                        height: 200,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    console.log("✅ QR Code gerado com sucesso!");
                } else {
                    throw new Error("QRCode.js não carregado");
                }
            }
            
            const pixCode = document.getElementById('pixCode');
            if (pixCode) {
                const chaveFormatada = CHAVE_PIX_FIXA.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '($1) $2 $3-$4');
                pixCode.textContent = chaveFormatada;
            }
            
            adicionarInstrucoesPix(valor);
            
        } catch (error) {
            console.error("❌ Erro ao gerar Pix:", error);
            if (qrcodeDiv) {
                qrcodeDiv.innerHTML = `
                    <div style="text-align:center; padding: 20px;">
                        <p style="color: #ef4444;">⚠️ Erro ao gerar QR Code</p>
                        <p style="color: #10b981; font-size: 1.2rem;">${CHAVE_PIX_FIXA}</p>
                    </div>
                `;
            }
        }
    }, 100);
}

function adicionarInstrucoesPix(valor) {
    const pixContainer = document.querySelector('.pix-section');
    if (pixContainer && !document.querySelector('.pix-instructions')) {
        const instrucoes = document.createElement('div');
        instrucoes.className = 'pix-instructions';
        instrucoes.style.marginTop = '20px';
        instrucoes.style.padding = '15px';
        instrucoes.style.background = 'rgba(16, 185, 129, 0.1)';
        instrucoes.style.borderRadius = '12px';
        instrucoes.innerHTML = `
            <p style="color: #10b981; font-size: 0.9rem; font-weight: 600;">💡 Como pagar com Pix:</p>
            <p style="color: #fff; font-size: 0.85rem;">1️⃣ Escaneie o QR Code com o app do seu banco</p>
            <p style="color: #fff; font-size: 0.85rem;">2️⃣ Confirme o valor de ${formatarMoeda(valor)}</p>
            <p style="color: #fff; font-size: 0.85rem;">3️⃣ Autorize o pagamento</p>
            <p style="color: #fff; font-size: 0.85rem;">4️⃣ Clique em "Confirmar Pagamento"</p>
        `;
        pixContainer.appendChild(instrucoes);
    }
}

const copyPixCodeBtn = document.getElementById('copyPixCode');
if (copyPixCodeBtn) {
    copyPixCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(CHAVE_PIX_FIXA);
        showMessage("✅ Chave Pix copiada!", "success");
    });
}

/* ===========================
   FUNÇÃO PARA ENVIAR WHATSAPP
=========================== */
function enviarWhatsAppConfirmacao(dadosAgendamento, metodoSelecionado, parcelas) {
    const telefone = dadosAgendamento.telefone || dadosAgendamento.whatsapp;
    if (!telefone) return false;
    
    const numeroLimpo = telefone.replace(/\D/g, "");
    if (numeroLimpo.length < 10) return false;

    let num = numeroLimpo;
    if (num.length === 10) {
        num = num.substring(0, 2) + '9' + num.substring(2);
    }

    let textoPagamento = '';
    const valorParcela = dadosAgendamento.valor / parcelas;
    
    switch(metodoSelecionado) {
        case 'pix':
            textoPagamento = '✅ Pagamento via Pix confirmado instantaneamente';
            break;
        case 'cartao_credito':
            if (parcelas > 1) {
                textoPagamento = `✅ Pagamento confirmado! ${parcelas}x de ${formatarMoeda(valorParcela)} no cartão de crédito`;
            } else {
                textoPagamento = '✅ Pagamento confirmado! Cartão de crédito (à vista)';
            }
            break;
        case 'cartao_debito':
            textoPagamento = '✅ Pagamento confirmado! Cartão de débito (à vista)';
            break;
        case 'dinheiro':
            textoPagamento = '💰 Pagamento será realizado em DINHEIRO no local da consulta';
            break;
        default:
            textoPagamento = '✅ Pagamento confirmado';
    }

    const metodoNome = {
        'pix': 'Pix',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'dinheiro': 'Dinheiro'
    }[metodoSelecionado] || metodoSelecionado;

    const isOnline = dadosAgendamento.tipoAtendimento !== 'Presencial';
    const localAtendimento = isOnline 
        ? 'Online (link enviado por WhatsApp)' 
        : 'Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB';

    const mensagem = `Olá ${dadosAgendamento.cliente || dadosAgendamento.nome}! 🥗✨\n\n` +
        `✅ *CONSULTA CONFIRMADA!*\n\n` +
        `${textoPagamento}\n\n` +
        `📝 *Detalhes da Consulta:*\n` +
        `• Plano: ${dadosAgendamento.servicoNome || dadosAgendamento.servico}\n` +
        `• Nutricionista: ${dadosAgendamento.profissional || 'Dra. Inês Raquel'}\n` +
        `• Tipo: ${isOnline ? 'Online' : 'Presencial'}\n` +
        `• Data: ${formatarData(dadosAgendamento.data)}\n` +
        `• Horário: ${dadosAgendamento.horario}\n` +
        `• Valor: ${formatarMoeda(dadosAgendamento.valor)}\n\n` +
        `💳 *Forma de Pagamento:* ${metodoNome}\n` +
        `${parcelas > 1 && metodoSelecionado === 'cartao_credito' ? `• ${parcelas}x de ${formatarMoeda(valorParcela)}\n` : ''}\n` +
        `📍 *Local:* ${localAtendimento}\n\n` +
        `⚠️ *Informações importantes:*\n` +
        `⏰ Chegue com 10 minutos de antecedência\n` +
        `📄 Leve seus exames e documentos\n` +
        `${isOnline ? '🔗 O link da videochamada será enviado 15 minutos antes' : ''}\n\n` +
        `✨ *Inês Raquel - Nutrição* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚`;

    const url = `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
    
    setTimeout(() => {
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    }, 500);
    
    return true;
}

/* ===========================
   FUNÇÃO PARA ENVIAR E-MAIL
=========================== */
async function enviarEmailConfirmacao(dadosAgendamento, metodoSelecionado, parcelas) {
    const emailCliente = dadosAgendamento.email;
    
    if (!emailCliente) {
        console.log("📧 Cliente não forneceu e-mail, pulando envio...");
        return false;
    }
    
    if (typeof emailjs === 'undefined') {
        console.error("❌ EmailJS não está carregado!");
        return false;
    }
    
    const isOnline = dadosAgendamento.tipoAtendimento !== 'Presencial';
    const localAtendimento = isOnline 
        ? 'Online (link enviado por WhatsApp)' 
        : 'Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB';
    
    const infoAtendimento = isOnline 
        ? '🔗 O link da videochamada será enviado 15 minutos antes do horário.'
        : '📍 Endereço: Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB, 58051-290';
    
    const valorFormatado = `R$ ${parseFloat(dadosAgendamento.valor).toFixed(2)}`;
    
    const metodoNome = {
        'pix': 'Pix',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'dinheiro': 'Dinheiro'
    }[metodoSelecionado] || metodoSelecionado;
    
    const textoPagamento = metodoSelecionado === 'dinheiro' 
        ? 'Pagamento em DINHEIRO - será realizado no local da consulta'
        : `Pagamento confirmado via ${metodoNome}`;
    
    const parcelasTexto = parcelas > 1 && metodoSelecionado === 'cartao_credito' 
        ? ` em ${parcelas}x` 
        : '';
    
    const templateParams = {
        cliente: dadosAgendamento.cliente || dadosAgendamento.nome,
        plano: dadosAgendamento.servicoNome || dadosAgendamento.servico,
        profissional: dadosAgendamento.profissional || 'Dra. Inês Raquel',
        tipo: isOnline ? 'Online' : 'Presencial',
        data: formatarData(dadosAgendamento.data),
        horario: dadosAgendamento.horario,
        valor: `${valorFormatado}${parcelasTexto}`,
        local: localAtendimento,
        info: infoAtendimento,
        metodoPagamento: textoPagamento,
        email: emailCliente,
        name: dadosAgendamento.cliente || dadosAgendamento.nome
    };
    
    console.log("📧 Enviando e-mail de confirmação para:", emailCliente);
    console.log("📧 Parâmetros:", templateParams);
    
    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams
        );
        console.log("✅ E-mail de confirmação enviado!");
        return true;
    } catch (error) {
        console.error("❌ Erro ao enviar e-mail:", error);
        return false;
    }
}

/* ===========================
   FUNÇÃO PRINCIPAL: Confirmar Pagamento
=========================== */
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
            pagamentoStatus: metodoSelecionado === 'dinheiro' ? "pendente_local" : "pago",
            metodoPagamento: metodoSelecionado,
            parcelas: parseInt(document.getElementById('parcelas')?.value || 1),
            dataPagamento: metodoSelecionado === 'dinheiro' ? null : new Date().toISOString().split('T')[0],
            atualizadoEm: Timestamp.now()
        });
        
        const pagamentosRef = collection(db, "pagamentos");
        await addDoc(pagamentosRef, {
            clienteId: dadosAgendamento.clienteId || null,
            servicoId: dadosAgendamento.servicoId || null,
            agendamentoId: dadosAgendamento.id,
            profissional: dadosAgendamento.profissional,
            valor: dadosAgendamento.valor,
            metodo: metodoSelecionado,
            parcelas: parseInt(document.getElementById('parcelas')?.value || 1),
            data: dadosAgendamento.data,
            status: metodoSelecionado === 'dinheiro' ? 'pendente' : 'pago',
            observacao: metodoSelecionado === 'dinheiro' 
                ? `Pagamento em dinheiro a ser realizado no local da consulta (${dadosAgendamento.servicoNome})`
                : `Pagamento via ${metodoSelecionado} para consulta de ${dadosAgendamento.servicoNome}`,
            createdAt: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        });
        
        showMessage("✅ Pagamento realizado com sucesso! Enviando confirmações...", "success");
        
        const parcelas = parseInt(document.getElementById('parcelas')?.value || 1);
        
        // Enviar WhatsApp
        enviarWhatsAppConfirmacao(dadosAgendamento, metodoSelecionado, parcelas);
        
        // Enviar E-mail
        await enviarEmailConfirmacao(dadosAgendamento, metodoSelecionado, parcelas);
        
        setTimeout(() => {
            window.location.href = 'agendamento-confirmado.html';
        }, 2500);
        
    } catch (error) {
        console.error("❌ Erro ao processar pagamento:", error);
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

function formatarData(data) {
    if (!data) return '-';
    if (data.includes('/')) return data;
    const partes = data.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
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
            console.log("✅ Agendamento encontrado:", dadosAgendamento);
            
            if (clienteNome) clienteNome.textContent = dadosAgendamento.cliente || dadosAgendamento.nome || '-';
            if (servicoNome) servicoNome.textContent = dadosAgendamento.servicoNome || dadosAgendamento.servico || '-';
            if (profissionalNome) profissionalNome.textContent = dadosAgendamento.profissional || 'Dra. Inês Raquel';
            if (agendamentoData) agendamentoData.textContent = formatarData(dadosAgendamento.data) || '-';
            if (agendamentoHorario) agendamentoHorario.textContent = dadosAgendamento.horario || '-';
            if (valorTotal) valorTotal.textContent = formatarMoeda(dadosAgendamento.valor || 0);
            
            if (btnConfirmar) btnConfirmar.disabled = true;
            
        } else {
            console.log("❌ Agendamento não encontrado para o ID:", agendamentoId);
            showMessage("Agendamento não encontrado.", "error");
        }
    } catch (error) {
        console.error("❌ Erro ao carregar dados:", error);
        showMessage("Erro ao carregar dados do agendamento: " + error.message, "error");
    }
}

// Autenticação
signInAnonymously(auth).then(() => {
    autenticado = true;
    carregarDados();
}).catch((error) => {
    console.error("❌ Erro na autenticação:", error);
    showMessage("Erro de autenticação.", "error");
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        autenticado = true;
        carregarDados();
    }
});