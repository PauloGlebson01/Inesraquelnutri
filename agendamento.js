/* ===========================
   IMPORTAÇÕES CORRETAS (CDN)
=========================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    Timestamp,
    setDoc,      // ✅ ADICIONADO
    doc          // ✅ ADICIONADO para referência de documento
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
  apiKey: "AIzaSyAmodWGagSV-yco1FQ1-U81Xhd-y4NsE3s",
  authDomain: "ines-raquel-softclick-nutri.firebaseapp.com",
  projectId: "ines-raquel-softclick-nutri",
  storageBucket: "ines-raquel-softclick-nutri.firebasestorage.app",
  messagingSenderId: "284677746064",
  appId: "1:284677746064:web:4daac55dd6b2491dbd9715",
  measurementId: "G-5C0YC43V2G"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===========================
   ELEMENTOS DO HTML
=========================== */
const form = document.getElementById("formAgendamento");
const nomeInput = document.getElementById("nome");
const telefoneInput = document.getElementById("telefone");
const servicoSelect = document.getElementById("servico");
const profissionalSelect = document.getElementById("profissional");
const dataInput = document.getElementById("data");
const horariosDiv = document.getElementById("horarios");
const horarioHidden = document.getElementById("horario");
const tipoAtendimentoHidden = document.getElementById("tipoAtendimento");
const mensagemDiv = document.getElementById("mensagem");
const loadingDiv = document.getElementById("loading");

// HORÁRIOS SEPARADOS POR TIPO DE ATENDIMENTO
const horariosOnlineSemana = ["14:00", "15:00", "16:00"];
const horariosPresencialSabado = ["14:00", "15:00", "16:00", "17:00", "18:00"];

let camposPreenchidos = { 
    nome: false, 
    telefone: false, 
    servico: false, 
    profissional: false,
    data: false 
};
let usuarioAutenticado = false;
let autenticacaoTentada = false;

/* ===========================
   FUNÇÃO PARA MOSTRAR ERROS VISÍVEIS AO CLIENTE
=========================== */
function mostrarErroCliente(mensagem) {
    if (!horariosDiv) return;
    horariosDiv.innerHTML = `
        <div class="aviso-campos erro" style="border-color: #ef4444;">
            <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
            <p style="color: #ef4444;">${mensagem}</p>
            <button onclick="location.reload()" style="margin-top: 12px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                <i class="fa-solid fa-rotate"></i> Tentar novamente
            </button>
        </div>
    `;
}

/* ===========================
   AUTENTICAÇÃO ANÔNIMA COM RETRY
=========================== */
function autenticar(tentativa = 1) {
    const maxTentativas = 3;
    
    signInAnonymously(auth)
        .then(() => {
            usuarioAutenticado = true;
            autenticacaoTentada = true;
            console.log("✅ Autenticado com sucesso!");
            verificarCamposPreenchidos();
        })
        .catch((error) => {
            console.error(`❌ Erro na autenticação (tentativa ${tentativa}/${maxTentativas}):`, error);
            
            if (tentativa < maxTentativas) {
                // Aguarda 1 segundo e tenta novamente
                setTimeout(() => autenticar(tentativa + 1), 1000);
            } else {
                autenticacaoTentada = true;
                mostrarErroCliente("⚠️ Problemas de conexão. Verifique sua internet e recarregue a página.");
            }
        });
}

// Inicia autenticação
autenticar();

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAutenticado = true;
        console.log("✅ Usuário autenticado:", user.uid);
        verificarCamposPreenchidos();
    } else if (!autenticacaoTentada) {
        autenticar();
    }
});

/* ===========================
   FUNÇÕES AUXILIARES
=========================== */
function formatarTelefone(valor) {
    let v = valor.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length >= 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length >= 8) v = v.replace(/(\(\d{2}\) \d{5})(\d)/, "$1-$2");
    return v.slice(0, 16);
}

if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => {
        e.target.value = formatarTelefone(e.target.value);
        verificarCamposPreenchidos();
    });
}

function getDiaSemana(dataStr) {
    if (!dataStr) return null;
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataUTC = new Date(Date.UTC(ano, mes - 1, dia));
    return dataUTC.getUTCDay();
}

function getNomeDiaSemana(dataStr) {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = getDiaSemana(dataStr);
    return dias[diaSemana];
}

function getInfoAtendimentoPorDia(dataStr) {
    const diaSemana = getDiaSemana(dataStr);
    
    if (diaSemana === 0) {
        return {
            temAtendimento: false,
            tipo: null,
            horarios: [],
            mensagem: "📅 Não realizamos atendimentos aos domingos. Por favor, escolha outro dia."
        };
    }
    else if (diaSemana === 6) {
        return {
            temAtendimento: true,
            tipo: "presencial",
            tipoIcone: "🏥",
            tipoNome: "Presencial",
            horarios: horariosPresencialSabado,
            cor: "#7c3aed",
            corFundo: "#ede9fe",
            mensagem: "Atendimento Presencial no consultório"
        };
    }
    else if (diaSemana >= 1 && diaSemana <= 5) {
        return {
            temAtendimento: true,
            tipo: "online",
            tipoIcone: "💻",
            tipoNome: "Online",
            horarios: horariosOnlineSemana,
            cor: "#10b981",
            corFundo: "#ecfdf5",
            mensagem: "Atendimento Online via videochamada"
        };
    }
    else {
        return {
            temAtendimento: false,
            tipo: null,
            horarios: [],
            mensagem: "Data inválida. Por favor, escolha outra data."
        };
    }
}

function verificarCamposPreenchidos() {
    const nome = nomeInput?.value.trim();
    const telefone = telefoneInput?.value.trim();
    const servico = servicoSelect?.value;
    const profissional = profissionalSelect?.value;
    const data = dataInput?.value;
    
    camposPreenchidos.nome = nome && nome.length >= 3;
    camposPreenchidos.telefone = telefone && telefone.replace(/\D/g, "").length >= 10;
    camposPreenchidos.servico = servico && servico !== "";
    camposPreenchidos.profissional = profissional && profissional !== "";
    camposPreenchidos.data = data && data !== "";
    
    const todosPreenchidos = Object.values(camposPreenchidos).every(v => v === true);
    
    if (todosPreenchidos && data && usuarioAutenticado) {
        atualizarHorarios();
    } else if (horariosDiv && !todosPreenchidos && usuarioAutenticado) {
        mostrarMensagemCampos();
    }
    return todosPreenchidos;
}

function mostrarMensagemCampos() {
    if (!horariosDiv) return;
    let mensagem = "";
    if (!camposPreenchidos.nome) mensagem = "Preencha seu nome completo";
    else if (!camposPreenchidos.telefone) mensagem = "Preencha seu WhatsApp";
    else if (!camposPreenchidos.servico) mensagem = "Selecione um serviço";
    else if (!camposPreenchidos.profissional) mensagem = "Selecione um profissional";
    else if (!camposPreenchidos.data) mensagem = "Selecione uma data";
    
    if (mensagem) {
        horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-info-circle"></i><p>${mensagem} para ver os horários disponíveis</p></div>`;
    }
}

function configurarDataMinima() {
    if (!dataInput) return;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataMinima = `${ano}-${mes}-${dia}`;
    dataInput.min = dataMinima;
    dataInput.value = dataMinima;
}

function mostrarMensagem(texto, tipo = 'sucesso') {
    if (!mensagemDiv) return;
    mensagemDiv.textContent = texto;
    mensagemDiv.className = tipo === 'sucesso' ? 'sucesso' : 'erro';
    setTimeout(() => { mensagemDiv.textContent = ''; mensagemDiv.className = ''; }, 5000);
}

function formatarDataParaMensagem(dataStr) {
    if (!dataStr) return 'Data não informada';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function enviarMensagemConfirmacaoGratuita(agendamento) {
    const telefone = agendamento.telefone || agendamento.whatsapp;
    if (!telefone) return false;

    const cliente = agendamento.cliente || agendamento.nome || 'cliente';
    const servico = agendamento.servicoNome || agendamento.servico || 'Retorno';
    const profissional = agendamento.profissional || 'nutricionista';
    const dataFormatada = formatarDataParaMensagem(agendamento.data);
    const horario = agendamento.horario || '--:--';
    const tipoAtendimento = agendamento.tipoAtendimento || 'Online';
    const localAtendimento = tipoAtendimento === 'Presencial' ? 'Consultório' : 'Online (link enviado por WhatsApp)';

    const mensagem = `Olá ${cliente}! 🥗✨\n\n` +
        `Sua consulta de *${servico}* foi *CONFIRMADA* com sucesso!\n\n` +
        `📝 *Detalhes:*\n` +
        `• Plano: ${servico}\n` +
        `• Nutricionista: ${profissional}\n` +
        `• Tipo: *${tipoAtendimento}*\n` +
        `• Data: ${dataFormatada}\n` +
        `• Horário: ${horario}\n` +
        `• Local: ${localAtendimento}\n` +
        `• Valor: *GRATUITO* 🎉\n\n` +
        `⚠️ *Importante:*\n` +
        `⏰ Chegue com 10 minutos de antecedência.\n` +
        `${tipoAtendimento === 'Online' ? '🔗 O link da videochamada será enviado 15 minutos antes do horário.' : '📍 Endereço: Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB, 58051-290'}\n\n` +
        `✨ *InêsRaquel* ✨\n` +
        `Cuidando da sua saúde com carinho e dedicação 💚`;

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

/* ===========================
   LOGICA DE HORÁRIOS (COM TRATAMENTO DE ERRO)
=========================== */
async function atualizarHorarios() {
    const data = dataInput.value;
    const profissional = profissionalSelect?.value;
    
    if (!data || !profissional) return;
    
    const infoAtendimento = getInfoAtendimentoPorDia(data);
    
    if (!infoAtendimento.temAtendimento) {
        horariosDiv.innerHTML = `
            <div class="aviso-campos">
                <i class="fa-solid fa-calendar-xmark"></i>
                <p>${infoAtendimento.mensagem}</p>
            </div>
        `;
        return;
    }
    
    if (horariosDiv) {
        horariosDiv.innerHTML = '<div class="loading-horarios"><i class="fas fa-spinner fa-spin"></i> Verificando disponibilidade...</div>';
    }

    try {
        // ✅ CORREÇÃO: Query mais simples primeiro, sem índice complexo
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(
            agendamentosRef, 
            where("data", "==", data),
            where("profissional", "==", profissional)
        );
        const snapshot = await getDocs(q);
        
        const ocupados = [];
        snapshot.forEach(doc => {
            const agendamento = doc.data();
            const status = agendamento.status || '';
            // Apenas horários confirmados ou aguardando pagamento são considerados ocupados
            if (agendamento.horario && (status === 'confirmado' || status === 'aguardando_pagamento')) {
                ocupados.push(agendamento.horario);
            }
        });
        
        console.log("✅ Horários disponíveis para", profissional, "- Ocupados:", ocupados);
        renderizarHorarios(ocupados, data);
        
    } catch (error) {
        console.error("❌ Erro ao buscar horários:", error);
        
        // Mostrar erro amigável para o cliente
        horariosDiv.innerHTML = `
            <div class="aviso-campos erro">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Erro ao carregar horários. Por favor, recarregue a página e tente novamente.</p>
                <p style="font-size: 0.75rem; margin-top: 8px;">Código do erro: ${error.message || 'Desconhecido'}</p>
                <button onclick="location.reload()" style="margin-top: 12px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Recarregar página
                </button>
            </div>
        `;
    }
}

function renderizarHorarios(ocupados = [], dataSelecionada) {
    if (!horariosDiv) return;
    
    const infoAtendimento = getInfoAtendimentoPorDia(dataSelecionada);
    const horariosDoDia = infoAtendimento.horarios;
    const tipoAtendimento = infoAtendimento.tipo;
    const tipoIcone = infoAtendimento.tipoIcone;
    const tipoNome = infoAtendimento.tipoNome;
    const corDestaque = infoAtendimento.cor;
    const corFundo = infoAtendimento.corFundo;
    const nomeDia = getNomeDiaSemana(dataSelecionada);
    
    horariosDiv.innerHTML = '';
    
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = `
        background: ${corFundo};
        padding: 14px 16px;
        border-radius: 16px;
        margin-bottom: 20px;
        text-align: center;
        border-left: 4px solid ${corDestaque};
    `;
    
    infoHeader.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 2rem;">${tipoIcone}</span>
            <div>
                <h3 style="margin: 0; color: ${corDestaque}; font-size: 1.1rem; font-weight: 700;">
                    Atendimento ${tipoNome}
                </h3>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #475569;">
                    ${infoAtendimento.mensagem} - ${nomeDia}
                </p>
            </div>
        </div>
    `;
    horariosDiv.appendChild(infoHeader);
    
    if (horariosDoDia.length === 0) {
        const aviso = document.createElement('div');
        aviso.className = 'aviso-campos';
        aviso.innerHTML = `
            <i class="fa-solid fa-calendar-day"></i>
            <p>Nenhum horário disponível para este dia.</p>
        `;
        horariosDiv.appendChild(aviso);
        return;
    }
    
    const containerBotoes = document.createElement('div');
    containerBotoes.className = 'botoes-horarios';
    
    let temHorariosDisponiveis = false;
    
    horariosDoDia.forEach(hora => {
        const isOcupado = ocupados.includes(hora);
        if (!isOcupado) temHorariosDisponiveis = true;
        
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `horario-btn ${isOcupado ? 'indisponivel' : ''}`;
        btn.textContent = hora;
        
        if (isOcupado) {
            btn.disabled = true;
            btn.title = "Horário já reservado";
        } else {
            btn.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll(".horario-btn").forEach(b => b.classList.remove("selecionado"));
                btn.classList.add("selecionado");
                if (horarioHidden) horarioHidden.value = hora;
                if (tipoAtendimentoHidden) tipoAtendimentoHidden.value = tipoAtendimento === "presencial" ? "Presencial" : "Online";
                console.log("✅ Horário selecionado:", hora, "Tipo:", tipoAtendimento);
            };
        }
        containerBotoes.appendChild(btn);
    });
    
    horariosDiv.appendChild(containerBotoes);
    
    if (!temHorariosDisponiveis) {
        const aviso = document.createElement('div');
        aviso.className = 'aviso-campos';
        aviso.style.marginTop = '16px';
        aviso.innerHTML = `
            <i class="fa-solid fa-calendar-xmark"></i>
            <p>⚠️ Nenhum horário disponível para este profissional nesta data.</p>
            <p style="font-size: 0.75rem; margin-top: 8px;">Tente outra data ou horário.</p>
        `;
        horariosDiv.appendChild(aviso);
    }
    
    const infoComplementar = document.createElement('div');
    infoComplementar.style.cssText = `
        margin-top: 20px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 16px;
        font-size: 0.75rem;
        color: #475569;
        text-align: center;
        border: 1px solid #e2e8f0;
    `;
    
    if (tipoAtendimento === "presencial") {
        infoComplementar.innerHTML = `
            <i class="fa-solid fa-location-dot" style="color: #7c3aed; margin-right: 6px;"></i> 
            <strong>Atendimento Presencial:</strong> Eco Medical Sul - R. Hercílio Alves de Souza, 108 - Bancários, João Pessoa - PB
            <br>
            <i class="fa-regular fa-clock"></i> Horário de funcionamento aos sábados: 14:00 às 18:00
        `;
    } else {
        infoComplementar.innerHTML = `
            <i class="fa-solid fa-video" style="color: #10b981; margin-right: 6px;"></i> 
            <strong>Atendimento Online:</strong> Você receberá o link da videochamada 15 minutos antes do horário agendado
            <br>
            <i class="fa-brands fa-whatsapp" style="margin-right: 4px;"></i> O link será enviado por WhatsApp
            <br>
            <i class="fa-regular fa-clock"></i> Horário de funcionamento (segunda a sexta): 14:00, 15:00 e 16:00
        `;
    }
    horariosDiv.appendChild(infoComplementar);
}

/* ===========================
   ENVIO DO FORMULÁRIO
=========================== */
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nome = nomeInput?.value.trim();
        const telefone = telefoneInput?.value.trim();
        const servico = servicoSelect?.value;
        const profissional = profissionalSelect?.value;
        const data = dataInput?.value;
        const horario = horarioHidden?.value;
        const tipoAtendimento = tipoAtendimentoHidden?.value;
        
        let finalTipoAtendimento = tipoAtendimento;
        if (!finalTipoAtendimento && data) {
            const infoAtendimento = getInfoAtendimentoPorDia(data);
            finalTipoAtendimento = infoAtendimento.tipo === "presencial" ? "Presencial" : "Online";
        }

        if (!nome || !telefone || !servico || !profissional || !data || !horario) {
            mostrarMensagem("⚠️ Preencha todos os campos e escolha um horário.", "erro");
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        }
        if (loadingDiv) loadingDiv.style.display = "block";

        const opcaoSelecionada = servicoSelect.options[servicoSelect.selectedIndex];
        const servicoTexto = opcaoSelecionada?.text || servico;
        const valor = Number(opcaoSelecionada?.dataset?.preco || 0);
        const ehGratuito = opcaoSelecionada?.getAttribute('data-gratuito') === 'true';

        const dadosAgendamento = {
            nome: nome,
            cliente: nome,
            telefone: telefone,
            whatsapp: telefone,
            servico: servico,
            servicoNome: servicoTexto,
            profissional: profissional,
            tipoAtendimento: finalTipoAtendimento,
            valor: valor,
            data: data,
            horario: horario,
            status: ehGratuito ? "confirmado" : "aguardando_pagamento",
            pagamentoStatus: ehGratuito ? "gratuito" : "pendente",
            ehGratuito: ehGratuito,
            createdAt: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        };

        try {
            const docRef = await addDoc(collection(db, "agendamentos"), dadosAgendamento);
            const agendamentoId = docRef.id;
            console.log("✅ Agendamento salvo! ID:", agendamentoId);
            
            if (ehGratuito) {
                mostrarMensagem("✅ Agendamento confirmado! Redirecionando...", "sucesso");
                enviarMensagemConfirmacaoGratuita(dadosAgendamento);
                
                setTimeout(() => {
                    window.location.href = `agendamento-confirmado.html`;
                }, 1500);
            } else {
                mostrarMensagem("✅ Agendamento pré-reservado! Redirecionando para pagamento...", "sucesso");
                
                setTimeout(() => {
                    window.location.href = `pagamento-cliente.html?agendamento=${agendamentoId}`;
                }, 1500);
            }
            
        } catch (error) {
            console.error("❌ Erro ao processar:", error);
            mostrarMensagem("❌ Erro ao processar seu agendamento. Tente novamente em alguns instantes.", "erro");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmar Agendamento';
            }
            if (loadingDiv) loadingDiv.style.display = "none";
        }
    });
}

// Eventos de Input
if (nomeInput) nomeInput.addEventListener('input', verificarCamposPreenchidos);
if (servicoSelect) servicoSelect.addEventListener('change', verificarCamposPreenchidos);
if (profissionalSelect) profissionalSelect.addEventListener('change', verificarCamposPreenchidos);

if (dataInput) {
    dataInput.addEventListener('change', () => {
        if (horarioHidden) horarioHidden.value = '';
        if (tipoAtendimentoHidden) tipoAtendimentoHidden.value = '';
        verificarCamposPreenchidos();
    });
}

configurarDataMinima();

setTimeout(() => {
    verificarCamposPreenchidos();
    console.log("✅ Verificação inicial executada");
}, 1000);