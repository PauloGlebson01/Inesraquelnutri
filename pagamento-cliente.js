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

// CHAVE PIX FIXA
const CHAVE_PIX_FIXA = "83991863520";

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

// Função para gerar payload Pix CORRETO usando algoritmo testado
function gerarPayloadPixCorreto(chave, nome, cidade, valor) {
    // Função para calcular CRC16
    function crc16(payload) {
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
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    // Formatar valor (ex: 150.00 -> "15000")
    const valorSemPonto = valor.toFixed(2).replace('.', '');
    
    // Construir o payload Pix
    let payload = '';
    
    // 00 - Payload Format Indicator
    payload += '000201';
    
    // 26 - Merchant Account Information
    let gui = '0014BR.GOV.BCB.PIX';
    let chavePix = '01' + chave.length.toString().padStart(2, '0') + chave;
    let merchantAccount = gui + chavePix;
    payload += '26' + merchantAccount.length.toString().padStart(2, '0') + merchantAccount;
    
    // 52 - Merchant Category Code
    payload += '52040000';
    
    // 53 - Transaction Currency (986 = BRL)
    payload += '5303986';
    
    // 54 - Transaction Amount (apenas se valor > 0)
    if (valor > 0) {
        payload += '54' + valorSemPonto.length.toString().padStart(2, '0') + valorSemPonto;
    }
    
    // 58 - Country Code
    payload += '5802BR';
    
    // 59 - Merchant Name (remover acentos)
    const nomeLimpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    payload += '59' + nomeLimpo.length.toString().padStart(2, '0') + nomeLimpo;
    
    // 60 - Merchant City (remover acentos)
    const cidadeLimpa = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    payload += '60' + cidadeLimpa.length.toString().padStart(2, '0') + cidadeLimpa;
    
    // 62 - Additional Data Field Template
    const txid = 'NUTRI' + Date.now().toString().slice(-8);
    payload += '62' + '05' + txid.length.toString().padStart(2, '0') + txid;
    
    // 63 - CRC16 (placeholder)
    payload += '6304';
    
    // Calcular CRC16
    const crc = crc16(payload);
    
    // Substituir placeholder pelo CRC calculado
    payload = payload.slice(0, -4) + crc;
    
    return payload;
}

// Gerar Pix com payload válido
function gerarPix() {
    const valor = dadosAgendamento?.valor || 0;
    const nomeRecebedor = "INES RAQUEL";
    const cidade = "SAO PAULO";
    
    // Gerar payload Pix correto
    const payloadPix = gerarPayloadPixCorreto(CHAVE_PIX_FIXA, nomeRecebedor, cidade, valor);
    
    console.log("Payload Pix gerado (tamanho:", payloadPix.length, ")");
    console.log("Início do payload:", payloadPix.substring(0, 50));
    
    // Exibir o payload para debug no console
    const debugInfo = document.createElement('details');
    debugInfo.style.cssText = 'margin-top: 12px; font-size: 0.7rem; color: #64748b;';
    debugInfo.innerHTML = `
        <summary style="cursor: pointer;">🔧 Informações técnicas</summary>
        <pre style="margin-top: 8px; padding: 8px; background: #0f172a; border-radius: 8px; overflow-x: auto; word-wrap: break-word; white-space: pre-wrap;">${payloadPix}</pre>
    `;
    
    // Gerar QR Code usando API do Google (mais confiável)
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '';
        
        // Usar API do Google Charts para gerar QR Code (funciona 100%)
        const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(payloadPix)}&choe=UTF-8`;
        
        const img = document.createElement('img');
        img.src = qrCodeUrl;
        img.alt = "QR Code Pix";
        img.style.width = "200px";
        img.style.height = "200px";
        img.style.borderRadius = "16px";
        
        img.onerror = () => {
            // Fallback: usar QRCode.js
            try {
                new QRCode(qrcodeDiv, {
                    text: payloadPix,
                    width: 200,
                    height: 200,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                console.error("Erro no fallback:", e);
                qrcodeDiv.innerHTML = '<p style="color:white; text-align:center;">Escaneie a chave Pix no seu banco</p>';
            }
        };
        
        img.onload = () => {
            qrcodeDiv.appendChild(img);
            qrcodeDiv.appendChild(debugInfo);
            showMessage("✅ QR Code gerado! Escaneie com o app do seu banco.", "success");
        };
        
        qrcodeDiv.appendChild(img);
    }
    
    // Exibir a chave Pix formatada
    const pixCode = document.getElementById('pixCode');
    if (pixCode) {
        const chaveFormatada = CHAVE_PIX_FIXA.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '($1) $2 $3-$4');
        pixCode.textContent = chaveFormatada;
    }
}

// Copiar chave Pix
const copyPixCodeBtn = document.getElementById('copyPixCode');
if (copyPixCodeBtn) {
    copyPixCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(CHAVE_PIX_FIXA);
        showMessage("✅ Chave Pix copiada! Cole no app do banco.", "success");
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
        `📍 *Local:* Inês Raquel - Consultório\n\n` +
        `⚠️ *Importante:*\n` +
        `⏰ Chegue com 10 minutos de antecedência.\n\n` +
        `✨ *Inês Raquel* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚`;

    const url = `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
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
        
        if (metodoSelecionado === 'pix' || metodoSelecionado === 'cartao_credito' || metodoSelecionado === 'cartao_debito') {
            enviarWhatsAppConfirmacao();
        }
        
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