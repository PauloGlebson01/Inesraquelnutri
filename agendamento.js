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
    Timestamp
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
const mensagemDiv = document.getElementById("mensagem");
const loadingDiv = document.getElementById("loading");

// Horários disponíveis
const horariosDisponiveis = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

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
   AUTENTICAÇÃO ANÔNIMA
=========================== */
function autenticar() {
    signInAnonymously(auth)
        .then(() => {
            usuarioAutenticado = true;
            autenticacaoTentada = true;
            console.log("Autenticado com sucesso!");
            verificarCamposPreenchidos();
        })
        .catch((error) => {
            console.error("Erro na autenticação:", error);
            autenticacaoTentada = true;
            verificarCamposPreenchidos();
        });
}

autenticar();

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAutenticado = true;
        console.log("Usuário autenticado:", user.uid);
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
    
    console.log("Campos preenchidos:", camposPreenchidos);
    
    const todosPreenchidos = Object.values(camposPreenchidos).every(v => v === true);
    
    if (todosPreenchidos && data && usuarioAutenticado) {
        atualizarHorarios();
    } else if (horariosDiv && !todosPreenchidos) {
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
    const dataMinima = hoje.toISOString().split('T')[0];
    dataInput.min = dataMinima;
    dataInput.value = dataMinima;
}

function mostrarMensagem(texto, tipo = 'sucesso') {
    if (!mensagemDiv) return;
    mensagemDiv.textContent = texto;
    mensagemDiv.className = tipo === 'sucesso' ? 'sucesso' : 'erro';
    setTimeout(() => { mensagemDiv.textContent = ''; mensagemDiv.className = ''; }, 5000);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/* ===========================
   LOGICA DE HORÁRIOS
=========================== */
async function atualizarHorarios() {
    const data = dataInput.value;
    const profissional = profissionalSelect?.value;
    
    if (!data || !profissional) return;
    
    console.log("Atualizando horários para data:", data, "profissional:", profissional);
    
    if (horariosDiv) {
        horariosDiv.innerHTML = '<div class="loading-horarios"><i class="fas fa-spinner fa-spin"></i> Verificando disponibilidade...</div>';
    }

    try {
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(
            agendamentosRef, 
            where("data", "==", data),
            where("profissional", "==", profissional),
            where("status", "in", ["confirmado", "aguardando_pagamento"])
        );
        const snapshot = await getDocs(q);
        
        const ocupados = [];
        snapshot.forEach(doc => {
            const agendamento = doc.data();
            if (agendamento.horario) {
                ocupados.push(agendamento.horario);
            }
        });
        
        console.log("Horários ocupados para", profissional, ":", ocupados);
        renderizarHorarios(ocupados);
        
    } catch (error) {
        console.error("Erro ao buscar horários:", error);
        if (horariosDiv) {
            horariosDiv.innerHTML = `
                <div class="aviso-campos erro">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar horários. Tente novamente.</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #6366f1; border: none; border-radius: 5px; color: white; cursor: pointer;">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }
}

function renderizarHorarios(ocupados = []) {
    if (!horariosDiv) return;
    
    horariosDiv.innerHTML = '';
    const containerBotoes = document.createElement('div');
    containerBotoes.className = 'botoes-horarios';
    
    let temHorariosDisponiveis = false;
    
    horariosDisponiveis.forEach(hora => {
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
                console.log("Horário selecionado:", hora);
            };
        }
        containerBotoes.appendChild(btn);
    });
    
    horariosDiv.appendChild(containerBotoes);
    
    if (!temHorariosDisponiveis) {
        const aviso = document.createElement('div');
        aviso.className = 'aviso-campos';
        aviso.innerHTML = `
            <i class="fa-solid fa-calendar-xmark"></i>
            <p>Nenhum horário disponível para este profissional nesta data. Por favor, escolha outra data ou profissional.</p>
        `;
        horariosDiv.appendChild(aviso);
    }
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

        console.log("Dados do formulário:", { nome, telefone, servico, profissional, data, horario });

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

        // Dados do agendamento com profissional
        const dadosAgendamento = {
            nome: nome,
            cliente: nome,
            telefone: telefone,
            whatsapp: telefone,
            servico: servico,
            servicoNome: servicoTexto,
            profissional: profissional,
            valor: valor,
            data: data,
            horario: horario,
            status: "aguardando_pagamento",
            pagamentoStatus: "pendente",
            createdAt: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        };

        try {
            const docRef = await addDoc(collection(db, "agendamentos"), dadosAgendamento);
            const agendamentoId = docRef.id;
            console.log("Agendamento salvo com sucesso! ID:", agendamentoId);
            
            mostrarMensagem("✅ Agendamento pré-reservado! Redirecionando para pagamento...", "sucesso");
            
            setTimeout(() => {
                window.location.href = `pagamento-cliente.html?agendamento=${agendamentoId}`;
            }, 1500);
            
        } catch (error) {
            console.error("Erro ao processar:", error);
            mostrarMensagem("❌ Erro ao processar. Tente novamente.", "erro");
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
        console.log("Data alterada:", dataInput.value);
        verificarCamposPreenchidos();
    });
}

configurarDataMinima();

// Forçar verificação inicial
setTimeout(() => {
    verificarCamposPreenchidos();
    console.log("Verificação inicial executada");
}, 1000);