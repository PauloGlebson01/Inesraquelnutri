import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let resultados = [];
let unsubscribeResultados = null;

// Elementos DOM
const resultadosGrid = document.getElementById('resultadosGrid');
const searchInput = document.getElementById('searchResultado');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoResultado = document.getElementById('btnNovoResultado');
const modalResultado = document.getElementById('modalResultado');
const modalExcluir = document.getElementById('modalExcluir');
const formResultado = document.getElementById('formResultado');
const modalTitle = document.getElementById('modalTitle');
const resultadoId = document.getElementById('resultadoId');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let resultadoParaExcluir = null;

// Funções auxiliares
function mostrarToast(mensagem, tipo = 'sucesso') {
    toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso'
        ? 'linear-gradient(135deg, #10b981, #059669)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Converter imagem para Base64
function imagemParaBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Configurar preview da imagem
function setupImagePreview() {
    const previewDiv = document.getElementById('imagePreview');
    const fileInput = document.getElementById('resultadoImagem');
    const urlInput = document.getElementById('resultadoImagemUrl');

    if (!previewDiv || !fileInput) return;

    previewDiv.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            mostrarToast('Por favor, selecione uma imagem', 'erro');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            mostrarToast('Imagem muito grande. Máximo 2MB', 'erro');
            return;
        }

        const base64 = await imagemParaBase64(file);
        if (base64) {
            previewDiv.innerHTML = `<img src="${base64}" style="width:100%; max-height:150px; object-fit:contain;">`;
            urlInput.value = base64;
            mostrarToast('Imagem carregada!', 'sucesso');
        }
    });
}

function resetImageForm() {
    const previewDiv = document.getElementById('imagePreview');
    const fileInput = document.getElementById('resultadoImagem');
    const urlInput = document.getElementById('resultadoImagemUrl');

    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewDiv) {
        previewDiv.innerHTML = '<i class="fa-solid fa-cloud-upload-alt"></i><span>Clique para selecionar uma imagem</span>';
    }
}

// Renderizar resultados
function renderizarResultados() {
    if (!resultadosGrid) return;

    let filtered = [...resultados];

    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(r =>
            r.titulo?.toLowerCase().includes(searchTerm) ||
            r.paciente?.toLowerCase().includes(searchTerm) ||
            r.descricao?.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        resultadosGrid.innerHTML = `
            <div class="empty-resultados">
                <i class="fa-solid fa-images"></i>
                <p>Nenhum resultado cadastrado</p>
                <button class="btn-primary" id="emptyBtnNovoResultado">
                    <i class="fa-solid fa-plus"></i> Adicionar Resultado
                </button>
            </div>
        `;

        const emptyBtn = document.getElementById('emptyBtnNovoResultado');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => abrirModalResultado());
        }
        return;
    }

    resultadosGrid.innerHTML = filtered.map(resultado => {
        const hasImage = resultado.imagemUrl && resultado.imagemUrl !== '';

        return `
            <div class="resultado-card" data-id="${resultado.id}">
                <div class="resultado-imagem">
                    ${hasImage
                ? `<img src="${resultado.imagemUrl}" alt="${escapeHtml(resultado.titulo)}" onerror="this.src='./assets/placeholder.jpg'">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.1));"><i class="fa-solid fa-image" style="font-size:3rem;color:#10b981;"></i></div>`
            }
                </div>
                <div class="resultado-info">
                    <h3>${escapeHtml(resultado.titulo || 'Sem título')}</h3>
                    ${resultado.paciente ? `<span class="resultado-paciente"><i class="fa-solid fa-user"></i> ${escapeHtml(resultado.paciente)}</span>` : ''}
                    <p class="resultado-descricao">${escapeHtml(resultado.descricao || 'Sem descrição')}</p>
                    <div class="resultado-meta">
                        <span class="resultado-periodo"><i class="fa-regular fa-calendar"></i> ${escapeHtml(resultado.periodo || '-')}</span>
                        <span class="resultado-meta-valor"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(resultado.meta || '-')}</span>
                    </div>
                </div>
                <div class="resultado-actions">
                    <button class="btn-edit-resultado" data-id="${resultado.id}">
                        <i class="fa-regular fa-pen-to-square"></i> Editar
                    </button>
                    <button class="btn-delete-resultado" data-id="${resultado.id}" data-titulo="${escapeHtml(resultado.titulo).replace(/'/g, "\\'")}">
                        <i class="fa-regular fa-trash-can"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Adicionar eventos aos botões de editar/excluir
    document.querySelectorAll('.btn-edit-resultado').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const resultado = resultados.find(r => r.id === id);
            if (resultado) abrirModalResultado(resultado);
        });
    });

    document.querySelectorAll('.btn-delete-resultado').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const titulo = btn.getAttribute('data-titulo');
            abrirModalExcluir(id, titulo);
        });
    });
}

// Carregar resultados do Firestore
function carregarResultados() {
    const q = query(collection(db, "resultados"), orderBy("ordem", "asc"));

    unsubscribeResultados = onSnapshot(q, (snapshot) => {
        resultados = [];
        snapshot.forEach(doc => {
            resultados.push({ id: doc.id, ...doc.data() });
        });
        renderizarResultados();
    }, (error) => {
        console.error("Erro ao carregar resultados:", error);
        if (resultadosGrid) {
            resultadosGrid.innerHTML = `
                <div class="empty-resultados">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar resultados: ${error.message}</p>
                </div>
            `;
        }
    });
}

// CRUD Resultados
async function salvarResultado(dados) {
    try {
        const imagemUrl = document.getElementById('resultadoImagemUrl').value;

        const resultadoData = {
            titulo: dados.titulo,
            descricao: dados.descricao || '',
            periodo: dados.periodo || '',
            meta: dados.meta || '',
            paciente: dados.paciente || '',
            ordem: Number(dados.ordem) || 0,
            imagemUrl: imagemUrl || '',
            atualizadoEm: Timestamp.now()
        };

        if (dados.id) {
            await updateDoc(doc(db, "resultados", dados.id), resultadoData);
            mostrarToast("Resultado atualizado com sucesso!");
        } else {
            resultadoData.createdAt = Timestamp.now();
            await addDoc(collection(db, "resultados"), resultadoData);
            mostrarToast("Resultado adicionado com sucesso!");
        }
        fecharModalResultado();
    } catch (error) {
        console.error("Erro ao salvar resultado:", error);
        mostrarToast("Erro ao salvar resultado.", "erro");
    }
}

async function deletarResultado(id) {
    try {
        await deleteDoc(doc(db, "resultados", id));
        mostrarToast("Resultado excluído com sucesso!");
        fecharModalExcluir();
    } catch (error) {
        console.error("Erro ao excluir resultado:", error);
        mostrarToast("Erro ao excluir resultado.", "erro");
    }
}

// Modal Functions
function abrirModalResultado(resultado = null) {
    resetImageForm();

    if (resultado) {
        modalTitle.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Resultado';
        resultadoId.value = resultado.id;
        document.getElementById('resultadoTitulo').value = resultado.titulo || '';
        document.getElementById('resultadoDescricao').value = resultado.descricao || '';
        document.getElementById('resultadoPeriodo').value = resultado.periodo || '';
        document.getElementById('resultadoMeta').value = resultado.meta || '';
        document.getElementById('resultadoPaciente').value = resultado.paciente || '';
        document.getElementById('resultadoOrdem').value = resultado.ordem || 0;

        if (resultado.imagemUrl) {
            document.getElementById('resultadoImagemUrl').value = resultado.imagemUrl;
            const preview = document.getElementById('imagePreview');
            if (preview) {
                preview.innerHTML = `<img src="${resultado.imagemUrl}" style="width:100%; max-height:150px; object-fit:contain;">`;
            }
        }
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Resultado';
        resultadoId.value = '';
        formResultado.reset();
        document.getElementById('resultadoOrdem').value = 0;
    }

    modalResultado.classList.add('active');
}

function fecharModalResultado() {
    modalResultado.classList.remove('active');
    resetImageForm();
}

function abrirModalExcluir(id, titulo) {
    resultadoParaExcluir = id;
    document.getElementById('excluirTitulo').textContent = titulo;
    modalExcluir.classList.add('active');
}

function fecharModalExcluir() {
    modalExcluir.classList.remove('active');
    resultadoParaExcluir = null;
}

// Event Listeners
if (formResultado) {
    formResultado.addEventListener('submit', (e) => {
        e.preventDefault();
        salvarResultado({
            id: resultadoId.value,
            titulo: document.getElementById('resultadoTitulo').value,
            descricao: document.getElementById('resultadoDescricao').value,
            periodo: document.getElementById('resultadoPeriodo').value,
            meta: document.getElementById('resultadoMeta').value,
            paciente: document.getElementById('resultadoPaciente').value,
            ordem: document.getElementById('resultadoOrdem').value
        });
    });
}

if (btnNovoResultado) {
    btnNovoResultado.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModalResultado();
    });
}

if (btnConfirmarExcluir) {
    btnConfirmarExcluir.addEventListener('click', () => {
        if (resultadoParaExcluir) deletarResultado(resultadoParaExcluir);
    });
}

if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        renderizarResultados();
    });
}

if (searchInput) {
    searchInput.addEventListener('input', renderizarResultados);
}

// Fechar modais
document.querySelectorAll('.modal-close, .modal-close-excluir, .btn-cancel, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalResultado();
        fecharModalExcluir();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalResultado) fecharModalResultado();
    if (e.target === modalExcluir) fecharModalExcluir();
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupImagePreview();
});

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarResultados();
    } else {
        window.location.href = 'login.html';
    }
});

// Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    };
}