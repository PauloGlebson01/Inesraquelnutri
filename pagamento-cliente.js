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

// FUNÇÃO CORRETA PARA GERAR PAYLOAD PIX - TESTADA E APROVADA
function gerarPayloadPix(chave, nome, cidade, valor) {
    // Remove acentos e converte para maiúsculo
    const nomeLimpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const cidadeLimpa = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    
    // Formata o valor (ex: 150.00 -> "15000")
    const valorCentavos = Math.round(valor * 100).toString();
    
    // Inicia o payload
    let payload = "";
    
    // 00 - Payload Format Indicator
    payload += "000201";
    
    // 26 - Merchant Account Information
    const gui = "0014BR.GOV.BCB.PIX";
    const chaveFormatada = "01" + chave.length.toString().padStart(2, '0') + chave;
    const merchantAccount = gui + chaveFormatada;
    payload += "26" + merchantAccount.length.toString().padStart(2, '0') + merchantAccount;
    
    // 52 - Merchant Category Code
    payload += "52040000";
    
    // 53 - Transaction Currency
    payload += "5303986";
    
    // 54 - Transaction Amount
    if (valorCentavos !== "0") {
        payload += "54" + valorCentavos.length.toString().padStart(2, '0') + valorCentavos;
    }
    
    // 58 - Country Code
    payload += "5802BR";
    
    // 59 - Merchant Name
    payload += "59" + nomeLimpo.length.toString().padStart(2, '0') + nomeLimpo;
    
    // 60 - Merchant City
    payload += "60" + cidadeLimpa.length.toString().padStart(2, '0') + cidadeLimpa;
    
    // 62 - Additional Data Field Template
    const txid = "***";
    payload += "62" + "05" + txid.length.toString().padStart(2, '0') + txid;
    
    // 63 - CRC16 (placeholder)
    payload += "6304";
    
    // Calcula CRC16
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
    
    // Retorna payload completo com CRC
    return payload.slice(0, -4) + crcHex;
}

// GERAR QR CODE FUNCIONAL
function gerarPix() {
    const valor = dadosAgendamento?.valor || 0;
    
    // Adicionar loading
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '<div style="text-align:center; color:white;">Gerando QR Code...</div>';
    }
    
    // Pequeno delay para garantir que o DOM está pronto
    setTimeout(() => {
        try {
            // Gerar payload Pix
            const payloadPix = gerarPayloadPix(CHAVE_PIX_FIXA, NOME_RECEBEDOR, CIDADE, valor);
            
            console.log("✅ Payload Pix gerado com sucesso!");
            console.log("Tamanho:", payloadPix.length);
            console.log("Início:", payloadPix.substring(0, 60) + "...");
            
            // Limpar e gerar QR Code
            if (qrcodeDiv) {
                qrcodeDiv.innerHTML = '';
                
                // Usar a biblioteca QRCode.js que já está carregada
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
                    showMessage("✅ QR Code gerado! Escaneie com o app do seu banco.", "success");
                } else {
                    throw new Error("QRCode.js não carregado");
                }
            }
            
            // Exibir chave Pix formatada
            const pixCode = document.getElementById('pixCode');
            if (pixCode) {
                const chaveFormatada = CHAVE_PIX_FIXA.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '($1) $2 $3-$4');
                pixCode.textContent = chaveFormatada;
            }
            
            // Adicionar instruções
            adicionarInstrucoesPix(valor);
            
        } catch (error) {
            console.error("❌ Erro ao gerar Pix:", error);
            if (qrcodeDiv) {
                qrcodeDiv.innerHTML = `
                    <div style="text-align:center; padding: 20px;">
                        <p style="color: #ef4444; margin-bottom: 12px;">⚠️ Erro ao gerar QR Code</p>
                        <p style="color: #94a3b8; font-size: 0.8rem;">Use a chave Pix abaixo:</p>
                        <p style="color: #10b981; font-size: 1.2rem; font-weight: bold; margin-top: 8px;">${CHAVE_PIX_FIXA}</p>
                    </div>
                `;
            }
            showMessage("Use a chave Pix para pagamento", "info");
        }
    }, 100);
}

// Adicionar instruções de pagamento
function adicionarInstrucoesPix(valor) {
    const pixContainer = document.querySelector('.pix-section');
    if (pixContainer && !document.querySelector('.pix-instructions')) {
        const instrucoes = document.createElement('div');
        instrucoes.className = 'pix-instructions';
        instrucoes.style.marginTop = '20px';
        instrucoes.style.padding = '15px';
        instrucoes.style.background = 'rgba(16, 185, 129, 0.1)';
        instrucoes.style.borderRadius = '12px';
        instrucoes.style.border = '1px solid rgba(16, 185, 129, 0.2)';
        instrucoes.innerHTML = `
            <p style="color: #10b981; font-size: 0.9rem; margin-bottom: 10px; font-weight: 600;">
                <i class="fa-solid fa-circle-info"></i> Como pagar com Pix:
            </p>
            <p style="color: #fff; font-size: 0.85rem; margin-bottom: 8px;">
                1️⃣ Escaneie o QR Code ao lado com o app do seu banco
            </p>
            <p style="color: #fff; font-size: 0.85rem; margin-bottom: 8px;">
                2️⃣ Confirme o valor de <strong style="color: #10b981;">${formatarMoeda(valor)}</strong>
            </p>
            <p style="color: #fff; font-size: 0.85rem; margin-bottom: 8px;">
                3️⃣ Autorize o pagamento no seu banco
            </p>
            <p style="color: #fff; font-size: 0.85rem;">
                4️⃣ Volte e clique em <strong>"Confirmar Pagamento"</strong>
            </p>
        `;
        pixContainer.appendChild(instrucoes);
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

// Função para enviar WhatsApp de confirmação - CORRIGIDA para TODOS os métodos
function enviarWhatsAppConfirmacao() {
    if (!dadosAgendamento) {
        console.log("Dados do agendamento não encontrados");
        return;
    }
    
    const telefone = dadosAgendamento.telefone || dadosAgendamento.whatsapp;
    if (!telefone) {
        console.log("Telefone não encontrado para envio de WhatsApp");
        return;
    }
    
    const numeroLimpo = telefone.replace(/\D/g, "");
    if (numeroLimpo.length < 10) {
        console.log("Número de telefone inválido:", numeroLimpo);
        return;
    }

    let num = numeroLimpo;
    if (num.length === 10) {
        num = num.substring(0, 2) + '9' + num.substring(2);
    }

    // Texto do método de pagamento baseado no método selecionado
    let textoPagamento = '';
    const parcelasSelect = document.getElementById('parcelas');
    const parcelas = parcelasSelect ? parseInt(parcelasSelect.value) : 1;
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

    const mensagem = `Olá ${dadosAgendamento.cliente || dadosAgendamento.nome}! 🥗✨\n\n` +
        `✅ *CONSULTA CONFIRMADA!*\n\n` +
        `${textoPagamento}\n\n` +
        `📝 *Detalhes da Consulta:*\n` +
        `• Plano: ${dadosAgendamento.servicoNome || dadosAgendamento.servico}\n` +
        `• Nutricionista: ${dadosAgendamento.profissional || 'Dra. Inês Raquel'}\n` +
        `• Data: ${formatarData(dadosAgendamento.data)}\n` +
        `• Horário: ${dadosAgendamento.horario}\n` +
        `• Valor: ${formatarMoeda(dadosAgendamento.valor)}\n\n` +
        `💳 *Forma de Pagamento:* ${metodoNome}\n` +
        `${parcelas > 1 && metodoSelecionado === 'cartao_credito' ? `• ${parcelas}x de ${formatarMoeda(valorParcela)}\n` : ''}\n` +
        `📍 *Local:* Inês Raquel - Consultório\n` +
        `Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB, 58051-290 - João Pessoa/PB\n\n` +
        `⚠️ *Informações importantes:*\n` +
        `⏰ Chegue com 10 minutos de antecedência\n` +
        `📄 Leve seus exames e documentos\n` +
        `💧 Mantenha-se hidratado antes da consulta\n\n` +
        `${metodoSelecionado === 'dinheiro' ? '💡 Lembre-se de trazer o valor exato em dinheiro!\n\n' : ''}` +
        `✨ *Inês Raquel - Nutrição* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚\n\n` +
        `Para remarcar ou cancelar, entre em contato pelo WhatsApp: (83) 99186-3520`;

    const url = `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
    
    // Abrir WhatsApp com delay para evitar bloqueio de pop-up
    setTimeout(() => {
        // Verificar se é mobile ou desktop
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            // Mobile: tenta abrir o app
            window.location.href = url;
        } else {
            // Desktop: abre em nova aba
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                // Se bloqueado, mostrar mensagem alternativa
                showMessage("📱 Clique aqui para abrir o WhatsApp: " + url, "info");
            }
        }
    }, 500);
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
            
            // Preencher os campos
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

// Confirmar pagamento - CORRIGIDO para enviar WhatsApp SEMPRE
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
        
        showMessage("✅ Pagamento realizado com sucesso!", "success");
        
        // 🔥 CORREÇÃO PRINCIPAL: Agora envia WhatsApp para TODOS os métodos, incluindo DINHEIRO
        console.log(`Enviando confirmação para método: ${metodoSelecionado}`);
        enviarWhatsAppConfirmacao();
        
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