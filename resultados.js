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
const modalGaleriaView = document.getElementById('modalGaleriaView');
const formResultado = document.getElementById('formResultado');
const modalTitle = document.getElementById('modalTitle');
const resultadoId = document.getElementById('resultadoId');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const galeriaImagens = document.getElementById('galeriaImagens');
const btnAdicionarImagem = document.getElementById('btnAdicionarImagem');
const imagemInput = document.getElementById('resultadoImagemInput');

let resultadoParaExcluir = null;
let imagensTemp = []; // Array para armazenar imagens temporariamente (Base64)

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

// ==================== FUNÇÕES DE IMAGEM CORRIGIDAS ====================

// Função otimizada para redimensionar imagens no cliente antes de converter para Base64
async function redimensionarImagem(file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calcular novas dimensões mantendo proporção
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                // Criar canvas para redimensionar
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converter para Base64 com compressão
                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Função melhorada para adicionar imagens (com redimensionamento automático)
async function adicionarImagens(files) {
    const novasImagens = [];
    let imagemGrandeIgnorada = false;
    
    for (const file of files) {
        // Verificação de tipo de arquivo (mais flexível)
        const isImage = file.type.startsWith('image/') || 
                       file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
        
        if (!isImage) {
            mostrarToast(`Arquivo ${file.name} não é uma imagem válida`, 'erro');
            continue;
        }
        
        // Verificar tamanho original (agora com limite maior: 10MB)
        if (file.size > 10 * 1024 * 1024) {
            if (!imagemGrandeIgnorada) {
                mostrarToast(`⚠️ ${file.name} é muito grande (>10MB). Apenas imagens até 10MB são aceitas.`, 'erro');
                imagemGrandeIgnorada = true;
            }
            continue;
        }
        
        try {
            // Mostrar loading para cada imagem
            if (files.length > 1) {
                mostrarToast(`📸 Processando ${files.indexOf(file) + 1}/${files.length}...`, 'info');
            }
            
            // Redimensionar imagem automaticamente (max 1024x1024, qualidade 70%)
            let base64Redimensionada = await redimensionarImagem(file, 1024, 1024, 0.7);
            
            if (base64Redimensionada) {
                // Verificar tamanho do Base64 (limitando a ~500KB após compressão)
                const base64Size = (base64Redimensionada.length * 3) / 4;
                if (base64Size > 600 * 1024) { // 600KB
                    // Tentar compressão mais agressiva
                    const base64Compactada = await redimensionarImagem(file, 800, 800, 0.5);
                    if (base64Compactada && (base64Compactada.length * 3) / 4 < 500 * 1024) {
                        novasImagens.push(base64Compactada);
                    } else {
                        novasImagens.push(base64Redimensionada);
                    }
                } else {
                    novasImagens.push(base64Redimensionada);
                }
            }
        } catch (error) {
            console.error(`Erro ao processar imagem ${file.name}:`, error);
            mostrarToast(`Erro ao processar ${file.name}. Tente outra imagem.`, 'erro');
        }
    }
    
    if (novasImagens.length > 0) {
        imagensTemp = [...imagensTemp, ...novasImagens];
        
        // Limite de 10 imagens (mantido)
        if (imagensTemp.length > 10) {
            imagensTemp = imagensTemp.slice(0, 10);
            mostrarToast('Limite de 10 imagens atingido. As primeiras 10 foram mantidas.', 'erro');
        }
        
        renderizarGaleriaImagens();
        mostrarToast(`${novasImagens.length} imagem(ns) adicionada(s) com sucesso!`, 'sucesso');
    }
}

// Função para capturar imagem da câmera (opcional - mobile)
async function capturarImagemCamera() {
    try {
        // Verificar se o dispositivo tem câmera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            mostrarToast("Seu dispositivo não suporta captura de câmera.", "erro");
            return;
        }
        
        // Criar input temporário com capture
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // 'user' para frontal, 'environment' para traseira
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                if (imagensTemp.length + files.length > 10) {
                    mostrarToast(`Limite de 10 imagens. Você pode adicionar no máximo ${10 - imagensTemp.length} imagem(ns).`, 'erro');
                    return;
                }
                await adicionarImagens(files);
            }
        };
        
        input.click();
    } catch (error) {
        console.error("Erro ao abrir câmera:", error);
        mostrarToast("Não foi possível acessar a câmera.", "erro");
    }
}

// Função para converter imagem para Base64 (fallback)
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

// Remover imagem da galeria temporária
function removerImagem(index) {
    imagensTemp.splice(index, 1);
    renderizarGaleriaImagens();
    mostrarToast('Imagem removida', 'sucesso');
}

// Renderizar galeria de imagens no formulário
function renderizarGaleriaImagens() {
    if (!galeriaImagens) return;
    
    if (imagensTemp.length === 0) {
        galeriaImagens.innerHTML = `
            <div class="galeria-empty">
                <i class="fa-regular fa-image"></i>
                <p>Nenhuma imagem adicionada</p>
                <span>Clique em "Adicionar Imagem" para começar</span>
            </div>
        `;
        return;
    }
    
    galeriaImagens.innerHTML = imagensTemp.map((img, index) => `
        <div class="galeria-item">
            <img src="${img}" alt="Imagem ${index + 1}">
            <button type="button" class="btn-remove-img" data-index="${index}" title="Remover imagem">
                <i class="fa-solid fa-times"></i>
            </button>
            <span class="img-numero">${index + 1}</span>
        </div>
    `).join('');
    
    // Adicionar eventos de remoção
    document.querySelectorAll('.btn-remove-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.getAttribute('data-index'));
            removerImagem(index);
        });
    });
}

// Reset do formulário de imagens
function resetImagensForm() {
    imagensTemp = [];
    renderizarGaleriaImagens();
    if (imagemInput) imagemInput.value = '';
}

// Adicionar estilos CSS para o modal de opções
function adicionarEstilosModalImagem() {
    if (document.getElementById('modal-imagem-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'modal-imagem-styles';
    style.textContent = `
        .modal-opcoes-imagem {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
        }
        
        .modal-opcoes-content {
            background: #1e293b;
            border-radius: 24px;
            padding: 24px;
            width: 90%;
            max-width: 320px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
            animation: modalFadeIn 0.3s ease;
        }
        
        .modal-opcoes-content h3 {
            color: #fff;
            margin-bottom: 20px;
            font-size: 1.1rem;
        }
        
        .modal-opcoes-content button {
            width: 100%;
            padding: 14px;
            margin-bottom: 12px;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .modal-opcoes-content button:first-of-type {
            background: #10b981;
            color: white;
        }
        
        .modal-opcoes-content button:first-of-type:hover {
            background: #059669;
            transform: translateY(-2px);
        }
        
        .modal-opcoes-content button:nth-of-type(2) {
            background: #3b82f6;
            color: white;
        }
        
        .modal-opcoes-content button:nth-of-type(2):hover {
            background: #2563eb;
            transform: translateY(-2px);
        }
        
        .modal-opcoes-content button:last-of-type {
            background: #475569;
            color: #cbd5e1;
            margin-bottom: 0;
        }
        
        .modal-opcoes-content button:last-of-type:hover {
            background: #ef4444;
            color: white;
        }
        
        @keyframes modalFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        @media (max-width: 480px) {
            .modal-opcoes-content {
                width: 95%;
                padding: 20px;
            }
        }
    `;
    document.head.appendChild(style);
}

// Configurar upload de imagens
function setupImageUpload() {
    if (!btnAdicionarImagem || !imagemInput) return;
    
    btnAdicionarImagem.addEventListener('click', () => {
        // Detectar se é dispositivo móvel
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Criar menu de opções para mobile
            const modalOpcoes = document.createElement('div');
            modalOpcoes.className = 'modal-opcoes-imagem';
            modalOpcoes.innerHTML = `
                <div class="modal-opcoes-content">
                    <h3><i class="fa-solid fa-image"></i> Adicionar Imagem</h3>
                    <button id="opcaoGaleria">📱 Escolher da Galeria</button>
                    <button id="opcaoCamera">📷 Tirar Foto</button>
                    <button id="fecharOpcoes">Cancelar</button>
                </div>
            `;
            
            document.body.appendChild(modalOpcoes);
            modalOpcoes.style.display = 'flex';
            
            document.getElementById('opcaoGaleria')?.addEventListener('click', () => {
                imagemInput.click();
                modalOpcoes.remove();
            });
            
            document.getElementById('opcaoCamera')?.addEventListener('click', () => {
                capturarImagemCamera();
                modalOpcoes.remove();
            });
            
            document.getElementById('fecharOpcoes')?.addEventListener('click', () => {
                modalOpcoes.remove();
            });
            
            // Fechar ao clicar fora
            modalOpcoes.addEventListener('click', (e) => {
                if (e.target === modalOpcoes) {
                    modalOpcoes.remove();
                }
            });
        } else {
            imagemInput.click();
        }
    });
    
    imagemInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        if (imagensTemp.length + files.length > 10) {
            mostrarToast(`Limite de 10 imagens. Você pode adicionar no máximo ${10 - imagensTemp.length} imagem(ns).`, 'erro');
            imagemInput.value = '';
            return;
        }
        
        await adicionarImagens(files);
        imagemInput.value = '';
    });
}

// Renderizar resultados no grid
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
        const imagens = resultado.imagens || [];
        const primeiraImagem = imagens.length > 0 ? imagens[0] : null;
        const totalImagens = imagens.length;

        return `
            <div class="resultado-card" data-id="${resultado.id}">
                <div class="resultado-imagem">
                    ${primeiraImagem
                        ? `<img src="${primeiraImagem}" alt="${escapeHtml(resultado.titulo)}" onerror="this.src='./assets/placeholder.jpg'">`
                        : `<div class="no-image"><i class="fa-solid fa-image"></i><span>Sem imagem</span></div>`
                    }
                    ${totalImagens > 1 ? `<div class="badge-multiplas">+${totalImagens - 1}</div>` : ''}
                </div>
                <div class="resultado-info">
                    <h3>${escapeHtml(resultado.titulo || 'Sem título')}</h3>
                    ${resultado.paciente ? `<span class="resultado-paciente"><i class="fa-solid fa-user"></i> ${escapeHtml(resultado.paciente)}</span>` : ''}
                    <p class="resultado-descricao">${escapeHtml(resultado.descricao ? resultado.descricao.substring(0, 80) + (resultado.descricao.length > 80 ? '...' : '') : 'Sem descrição')}</p>
                    <div class="resultado-meta">
                        <span class="resultado-periodo"><i class="fa-regular fa-calendar"></i> ${escapeHtml(resultado.periodo || '-')}</span>
                        <span class="resultado-meta-valor"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(resultado.meta || '-')}</span>
                    </div>
                </div>
                <div class="resultado-actions">
                    <button class="btn-view-galeria" data-id="${resultado.id}" data-titulo="${escapeHtml(resultado.titulo).replace(/'/g, "\\'")}">
                        <i class="fa-solid fa-images"></i> Ver Galeria (${totalImagens})
                    </button>
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

    // Adicionar eventos
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

    document.querySelectorAll('.btn-view-galeria').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const resultado = resultados.find(r => r.id === id);
            if (resultado) abrirModalGaleriaView(resultado);
        });
    });
}

// Abrir modal de visualização da galeria
function abrirModalGaleriaView(resultado) {
    const imagens = resultado.imagens || [];
    const titulo = document.getElementById('galeriaViewTitulo');
    const container = document.getElementById('galeriaViewContainer');
    
    if (titulo) {
        titulo.innerHTML = `<i class="fa-solid fa-images"></i> ${escapeHtml(resultado.titulo)} - ${escapeHtml(resultado.paciente || 'Paciente')}`;
    }
    
    if (container) {
        if (imagens.length === 0) {
            container.innerHTML = `
                <div class="galeria-view-empty">
                    <i class="fa-regular fa-image"></i>
                    <p>Este resultado não possui imagens</p>
                </div>
            `;
        } else {
            container.innerHTML = imagens.map((img, index) => `
                <div class="galeria-view-item">
                    <img src="${img}" alt="Imagem ${index + 1} - ${escapeHtml(resultado.titulo)}">
                    <div class="galeria-view-caption">Imagem ${index + 1} de ${imagens.length}</div>
                </div>
            `).join('');
            
            // Adicionar evento de clique para abrir em tela cheia (opcional)
            container.querySelectorAll('.galeria-view-item img').forEach(img => {
                img.addEventListener('click', () => {
                    const index = parseInt(img.getAttribute('data-index')) || 0;
                    if (window.abrirCarrossel) {
                        window.abrirCarrossel(imagens, resultado.titulo);
                    }
                });
            });
        }
    }
    
    if (modalGaleriaView) {
        modalGaleriaView.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModalGaleriaView() {
    if (modalGaleriaView) {
        modalGaleriaView.classList.remove('active');
        document.body.style.overflow = '';
    }
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
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                        <i class="fa-solid fa-rotate"></i> Tentar novamente
                    </button>
                </div>
            `;
        }
    });
}

// Salvar resultado (com múltiplas imagens)
async function salvarResultado(dados) {
    try {
        const resultadoData = {
            titulo: dados.titulo,
            descricao: dados.descricao || '',
            periodo: dados.periodo || '',
            meta: dados.meta || '',
            paciente: dados.paciente || '',
            ordem: Number(dados.ordem) || 0,
            imagens: imagensTemp, // Array de imagens Base64
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
        mostrarToast("Erro ao salvar resultado. Tente novamente.", "erro");
    }
}

// Deletar resultado
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
    resetImagensForm();

    if (resultado) {
        modalTitle.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Resultado';
        resultadoId.value = resultado.id;
        document.getElementById('resultadoTitulo').value = resultado.titulo || '';
        document.getElementById('resultadoDescricao').value = resultado.descricao || '';
        document.getElementById('resultadoPeriodo').value = resultado.periodo || '';
        document.getElementById('resultadoMeta').value = resultado.meta || '';
        document.getElementById('resultadoPaciente').value = resultado.paciente || '';
        document.getElementById('resultadoOrdem').value = resultado.ordem || 0;

        // Carregar imagens existentes
        if (resultado.imagens && resultado.imagens.length > 0) {
            imagensTemp = [...resultado.imagens];
            renderizarGaleriaImagens();
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
    resetImagensForm();
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
        
        const titulo = document.getElementById('resultadoTitulo').value.trim();
        if (!titulo) {
            mostrarToast("Informe o título do resultado.", "erro");
            return;
        }
        
        salvarResultado({
            id: resultadoId.value,
            titulo: titulo,
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
document.querySelectorAll('.modal-close, .modal-close-excluir, .modal-close-galeria, .btn-cancel, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalResultado();
        fecharModalExcluir();
        fecharModalGaleriaView();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalResultado) fecharModalResultado();
    if (e.target === modalExcluir) fecharModalExcluir();
    if (e.target === modalGaleriaView) fecharModalGaleriaView();
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupImageUpload();
    adicionarEstilosModalImagem();
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