import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const notificacao = document.getElementById('notificacao');
const notificationSound = document.getElementById('notificationSound');

let chartFaturamento = null;
let chartServicos = null;
let primeiraCarga = true;

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function mostrarNotificacao(mensagem) {
    if (notificacao) {
        notificacao.querySelector('span').textContent = mensagem;
        notificacao.style.display = 'flex';
        if (notificationSound) {
            notificationSound.play().catch(e => console.log("Som requer interação do usuário"));
        }
        setTimeout(() => { notificacao.style.display = 'none'; }, 5000);
    }
}

function alternarTelas(logado) {
    if (logado) {
        painel.style.display = 'flex';
    } else {
        painel.style.display = 'none';
        window.location.href = 'login.html';
    }
}

function carregarDadosDashboard() {
    console.log("🔄 Monitorando base de dados em tempo real...");
    const agendamentosRef = collection(db, "agendamentos");

    onSnapshot(agendamentosRef, (snapshot) => {
        let faturamentoTotal = 0;
        let atendimentosConcluidos = 0;
        let valorPendente = 0;
        let servicosPorMes = {};
        let servicosPorNome = {};

        if (!primeiraCarga && snapshot.docChanges().some(change => change.type === "added")) {
            mostrarNotificacao("Novo agendamento registrado!");
        }

        snapshot.forEach(doc => {
            const agendamento = doc.data();
            const valor = parseFloat(agendamento.valor) || 0;
            const status = (agendamento.status || '').toLowerCase();
            const dataAgendamento = agendamento.data;
            const nomeServico = agendamento.servicoNome || agendamento.servico || 'Outros';

            if (status === 'concluido') {
                faturamentoTotal += valor;
                atendimentosConcluidos++;

                if (dataAgendamento) {
                    let data;
                    if (typeof dataAgendamento === 'string') {
                        data = new Date(dataAgendamento);
                    } else if (dataAgendamento?.toDate) {
                        data = dataAgendamento.toDate();
                    } else if (dataAgendamento?.seconds) {
                        data = new Date(dataAgendamento.seconds * 1000);
                    } else {
                        data = new Date(dataAgendamento);
                    }

                    if (!isNaN(data.getTime())) {
                        const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                        servicosPorMes[mesAno] = (servicosPorMes[mesAno] || 0) + valor;
                    }
                }
            }

            if (status === 'confirmado') {
                valorPendente += valor;
            }

            servicosPorNome[nomeServico] = (servicosPorNome[nomeServico] || 0) + 1;
        });

        document.getElementById('faturamentoTotal').textContent = formatarMoeda(faturamentoTotal);
        document.getElementById('qtdConcluidos').textContent = atendimentosConcluidos;
        document.getElementById('projecaoPendente').textContent = formatarMoeda(valorPendente);
        
        const ticketMedio = atendimentosConcluidos > 0 ? faturamentoTotal / atendimentosConcluidos : 0;
        document.getElementById('ticketMedio').textContent = formatarMoeda(ticketMedio);

        prepararEAtualizarGraficos(servicosPorMes, servicosPorNome);
        
        primeiraCarga = false;
        console.log("✅ Dados sincronizados.");
    });
}

function prepararEAtualizarGraficos(dadosMes, dadosNome) {
    const ultimos6 = obterUltimos6Meses();
    const labelsFaturamento = ultimos6.map(mes => formatarMes(mes));
    const valoresFaturamento = ultimos6.map(mes => dadosMes[mes] || 0);

    atualizarGraficoFaturamento(labelsFaturamento, valoresFaturamento);
    atualizarGraficoServicos(dadosNome);
}

function atualizarGraficoFaturamento(labels, dados) {
    const ctx = document.getElementById('faturamentoChart').getContext('2d');
    if (chartFaturamento) chartFaturamento.destroy();
    
    chartFaturamento = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento Mensal',
                data: dados,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#94a3b8' } 
                },
                x: { 
                    ticks: { color: '#94a3b8' }, 
                    grid: { display: false } 
                }
            },
            plugins: { 
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `R$ ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

function atualizarGraficoServicos(servicosMap) {
    const ctx = document.getElementById('pacientesChart').getContext('2d');
    if (chartServicos) chartServicos.destroy();

    const labels = Object.keys(servicosMap);
    const valores = Object.values(servicosMap);

    chartServicos = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: ['#10b981', '#84cc16', '#ec489a', '#f59e0b',],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff', boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

function obterUltimos6Meses() {
    const meses = [];
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return meses;
}

function formatarMes(mesAno) {
    const [ano, mes] = mesAno.split('-');
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${nomes[parseInt(mes)-1]}/${ano.slice(-2)}`;
}

// AUTENTICAÇÃO - Verificar se está logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário autenticado:", user.email);
        alternarTelas(true);
        carregarDadosDashboard();
    } else {
        console.log("Usuário não autenticado");
        alternarTelas(false);
    }
});

// Logout
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            console.log("Logout realizado com sucesso");
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };
}