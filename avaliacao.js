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
const db = getFirestore(app);

/* ===========================
   ELEMENTOS DO DOM
=========================== */
const clienteNomeEl = document.getElementById('clienteNome');
const servicoNomeEl = document.getElementById('servicoNome');
const estrelasContainer = document.getElementById('estrelasContainer');
const notaSelecionadaEl = document.getElementById('notaSelecionada');
const btnEnviar = document.getElementById('btnEnviar');
const mensagemEl = document.getElementById('mensagem');
const comentarioEl = document.getElementById('comentario');

let notaSelecionada = 0;
let avaliacaoDocId = null;

function mostrarMensagem(texto, tipo = 'info') {
    mensagemEl.textContent = texto;
    mensagemEl.className = `mensagem ${tipo}`;
    setTimeout(() => {
        mensagemEl.className = 'mensagem';
        mensagemEl.textContent = '';
    }, 5000);
}

function atualizarEstrelas(nota) {
    const estrelas = document.querySelectorAll('.estrela');
    estrelas.forEach((estrela, index) => {
        const estrelaNota = parseInt(estrela.dataset.nota);
        if (estrelaNota <= nota) {
            estrela.className = 'fa-solid fa-star estrela ativa';
        } else {
            estrela.className = 'fa-regular fa-star estrela';
        }
    });
    
    const textos = {
        1: 'Muito Ruim - Vamos melhorar! 😔',
        2: 'Ruim - Precisamos melhorar 😐',
        3: 'Bom - Ficamos felizes! 🙂',
        4: 'Muito Bom - Obrigado! 😊',
        5: 'Excelente! Ficamos muito felizes! 🎉✨'
    };
    
    if (nota > 0) {
        const estrelasTexto = '⭐'.repeat(nota);
        notaSelecionadaEl.innerHTML = `<i class="fa-solid fa-star" style="color: #fbbf24;"></i> Nota: ${estrelasTexto} (${nota}/5) - ${textos[nota]}`;
    } else {
        notaSelecionadaEl.innerHTML = `<i class="fa-regular fa-star"></i> Clique nas estrelas para avaliar`;
    }
}

function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        id: urlParams.get('id'),
        cliente: decodeURIComponent(urlParams.get('cliente') || ''),
        servico: decodeURIComponent(urlParams.get('servico') || ''),
        nota: parseInt(urlParams.get('nota') || '0')
    };
}

async function buscarAvaliacao(avaliacaoIdParam) {
    try {
        console.log("🔍 Buscando avaliação com ID:", avaliacaoIdParam);
        
        const avaliacoesRef = collection(db, "avaliacoes");
        const q = query(avaliacoesRef, where("id", "==", avaliacaoIdParam));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            avaliacaoDocId = docSnap.id;
            console.log("✅ Avaliação encontrada!");
            return docSnap.data();
        }
        
        console.log("⚠️ Nenhuma avaliação encontrada com este ID");
        return null;
    } catch (error) {
        console.error("❌ Erro ao buscar avaliação:", error);
        return null;
    }
}

async function criarAvaliacao(avaliacaoIdParam, cliente, servico) {
    try {
        console.log("📝 Criando nova avaliação para:", cliente);
        
        const avaliacoesRef = collection(db, "avaliacoes");
        const docRef = await addDoc(avaliacoesRef, {
            id: avaliacaoIdParam,
            clienteNome: cliente,
            servicoNome: servico,
            nota: 0,
            comentario: '',
            status: "pendente",
            dataCriacao: Timestamp.now()
        });
        avaliacaoDocId = docRef.id;
        console.log("✅ Avaliação criada com ID:", avaliacaoDocId);
        return { id: docRef.id, clienteNome: cliente, servicoNome: servico, nota: 0, comentario: '' };
    } catch (error) {
        console.error("❌ Erro ao criar avaliação:", error);
        return null;
    }
}

async function salvarAvaliacao(nota, comentario) {
    if (!avaliacaoDocId) {
        throw new Error("ID da avaliação não encontrado");
    }
    
    const avaliacaoRef = doc(db, "avaliacoes", avaliacaoDocId);
    await updateDoc(avaliacaoRef, {
        nota: nota,
        comentario: comentario,
        status: "concluida",
        dataAvaliacao: Timestamp.now()
    });
    console.log(`✅ Avaliação salva! Nota: ${nota}`);
}

// Eventos
if (estrelasContainer) {
    estrelasContainer.addEventListener('click', (e) => {
        const estrela = e.target.closest('.estrela');
        if (!estrela) return;
        
        notaSelecionada = parseInt(estrela.dataset.nota);
        atualizarEstrelas(notaSelecionada);
        
        estrela.classList.add('selecionada');
        setTimeout(() => estrela.classList.remove('selecionada'), 300);
    });
}

if (btnEnviar) {
    btnEnviar.addEventListener('click', async () => {
        if (notaSelecionada === 0) {
            mostrarMensagem('⚠️ Por favor, selecione uma nota antes de enviar.', 'erro');
            return;
        }
        
        const comentario = comentarioEl?.value.trim() || '';
        
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<span class="loading"></span> Enviando avaliação...';
        
        try {
            await salvarAvaliacao(notaSelecionada, comentario);
            mostrarMensagem('✅ Avaliação enviada com sucesso! Muito obrigado pelo seu feedback! 💚', 'sucesso');
            
            if (estrelasContainer) estrelasContainer.style.pointerEvents = 'none';
            if (comentarioEl) comentarioEl.disabled = true;
            
            btnEnviar.innerHTML = '<i class="fa-regular fa-circle-check"></i> Avaliação Enviada';
            
            setTimeout(() => { window.location.href = 'agendamento.html'; }, 3000);
            
        } catch (error) {
            console.error('❌ Erro ao enviar:', error);
            mostrarMensagem('❌ Erro ao enviar avaliação. Tente novamente.', 'erro');
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Enviar Avaliação';
        }
    });
}

// Inicialização
async function inicializar() {
    console.log("🔄 Inicializando página de avaliação...");
    
    const params = getUrlParams();
    const avaliacaoId = params.id;
    const clienteNome = params.cliente;
    const servicoNome = params.servico;
    const notaInicial = params.nota;
    
    console.log("📋 Parâmetros recebidos:", { avaliacaoId, clienteNome, servicoNome, notaInicial });
    
    if (!avaliacaoId) {
        mostrarMensagem('❌ Link de avaliação inválido.', 'erro');
        if (clienteNomeEl) clienteNomeEl.textContent = 'Erro ao carregar';
        if (servicoNomeEl) servicoNomeEl.textContent = 'Link inválido';
        return;
    }
    
    if (clienteNomeEl) clienteNomeEl.textContent = clienteNome || 'Cliente';
    if (servicoNomeEl) servicoNomeEl.textContent = servicoNome ? `Plano: ${servicoNome}` : 'Consulta realizada';
    
    let avaliacao = await buscarAvaliacao(avaliacaoId);
    
    if (!avaliacao) {
        avaliacao = await criarAvaliacao(avaliacaoId, clienteNome || 'Cliente', servicoNome || 'Consulta');
    }
    
    if (avaliacao && avaliacao.nota > 0 && avaliacao.status === 'concluida') {
        notaSelecionada = avaliacao.nota;
        atualizarEstrelas(notaSelecionada);
        
        if (comentarioEl) {
            comentarioEl.value = avaliacao.comentario || '';
            comentarioEl.disabled = true;
        }
        
        if (estrelasContainer) estrelasContainer.style.pointerEvents = 'none';
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<i class="fa-regular fa-circle-check"></i> Avaliação já realizada';
        }
        
        mostrarMensagem('✅ Você já avaliou esta consulta. Muito obrigado!', 'info');
        
    } else if (notaInicial > 0 && notaInicial <= 5) {
        notaSelecionada = notaInicial;
        atualizarEstrelas(notaSelecionada);
        
        const estrelaCorrespondente = document.querySelector(`.estrela[data-nota="${notaInicial}"]`);
        if (estrelaCorrespondente) {
            estrelaCorrespondente.classList.add('selecionada');
            setTimeout(() => estrelaCorrespondente.classList.remove('selecionada'), 500);
        }
    } else {
        atualizarEstrelas(0);
    }
    
    console.log("✅ Página de avaliação carregada!");
    console.log(`🔗 ID da avaliação: ${avaliacaoId}`);
}

inicializar();