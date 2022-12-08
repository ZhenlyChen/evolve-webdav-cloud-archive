// ==UserScript==
// @name         云存档
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://pmotschmann.github.io/Evolve/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.io
// @grant        none
// @require      https://static-1252808268.cos.ap-guangzhou.myqcloud.com/webdav.js
// ==/UserScript==

let UIHandler = {}
let client = null

async function getArchiveList() {
  if (!client || !UIHandler.control) {
    return
  }
  console.log('【云存档】加载存档...')
  const archives = await client.getDirectoryContents('/', { glob: '/archive_*.txt' })
  console.log('archives', archives)
  archives.forEach(it => it.updateTime = new Date(it.lastmod).getTime())
  UIHandler.archiveSelect.innerHTML = ''
  UIHandler.archiveSelect.appendChild(UIHandler.newArchiveItem)
  UIHandler.archiveSelect.disabled = false
  UIHandler.newBtn.disabled = false
  if (archives.length === 0) {
    UIHandler.archiveSelect.selectedIndex = 0
    return
  }
  archives.sort((a, b) => b.updateTime - a.updateTime).forEach(it => {
    const archiveItem = document.createElement('option')
    const name = it.basename.substr(8, it.basename.length - 12)
    archiveItem.appendChild(document.createTextNode(decodeURIComponent(name)))
    archiveItem.setAttribute('value', it.filename)
    UIHandler.archiveSelect.appendChild(archiveItem)
  })
  UIHandler.archiveSelect.selectedIndex = 1
  UIHandler.loadBtn.disabled = false
  UIHandler.deleteBtn.disabled = false
}

async function initClient(config) {
  console.log('【云存档】初始化客户端...')
  const testClient = WebDAV.createClient(config.url, {
    username: config.username,
    password: config.password
  })
  try {
    const dir = await testClient.getDirectoryContents('/', { glob: '/history' })
    if (dir.length === 0) {
      await testClient.createDirectory('/history')
    } else if (dir[0].type !== 'directory') {
      await testClient.deleteFile('/history')
      await testClient.createDirectory('/history')
    }
    client = testClient
    await getArchiveList()
    return ''
  } catch (e) {
    return e.message
  }
}

async function backupArchive(fileName) {
  if (!fileName) {
    return
  }
  const backupFileName = `/history/archive_backup_${new Date().getTime()}_${fileName.substr(9)}`
  try {
    await client.moveFile(fileName, backupFileName)
  } catch(e) {
    alert('备份存档失败：' + e.message)
  }
}

function saveArchive() {
  const selected = UIHandler.archiveSelect.selectedOptions[0]
  let oldFileName = selected.value
  let fileName = selected.value
  if (!selected.value) {
    let inputName = prompt('请输入存档名称（未输入默认为default）：')
    if (!inputName) {
      inputName = 'default'
    }
    inputName = encodeURIComponent(inputName)
    fileName = `/archive_${inputName}.txt`
  }
  console.log('【云存档】导出存档...')
  UIHandler.exportBtn.click()
  let data = ''
  let count = 5;
  const timer = setInterval(() => {
    data = UIHandler.archiveText.value
    count--
    if (count <= 0 || !!data) {
      clearInterval(timer)
      if (!!data) {
        console.log('【云存档】上传存档...')
        backupArchive(oldFileName).then(() => {
          client.putFileContents(fileName, data).then(() => {
            alert('存档成功！')
            getArchiveList().then()
          }).catch(e => {
            alert('存档失败：' + e.message)
          })
        })
      }
    }
    UIHandler.exportBtn.click()
  }, 1000)
}

function loadArchive() {
  const selected = UIHandler.archiveSelect.selectedOptions[0]
  if (!selected.value) {
    return
  }
  client.getFileContents(selected.value, { format: "text" }).then(data => {
    UIHandler.archiveText.value = data
    UIHandler.importBtn.click()
  }).catch(e => {
    alert('加载存档失败：' + e.message)
  })
}

function deleteArchive() {
  const selected = UIHandler.archiveSelect.selectedOptions[0]
  if (!selected.value) {
    return
  }
  if (confirm(`确定删除存档${selected.innerHTML}？`)) {
    backupArchive(selected.value).then(() => {
      alert('删除存档成功！')
      getArchiveList().then()
    })
  }
}

function loadConfig() {
  let configStr = localStorage.getItem('cloudArchiveConfig')
  const config = (configStr && JSON.parse(configStr)) || {}
  return config
}

async function initConfig() {
  const url = prompt('请输入WebDAV完整地址（如：https://xxx.com/Evolve/Archive/）')
  const username = prompt('请输入用户名：')
  const password = prompt('请输入密码：')
  const config = {
    url, username, password
  }
  if (!confirm('确认以下配置：\n' + JSON.stringify(config))) {
    return
  }
  let error = ''
  if (error = await initClient(config)) {
    alert('无效的配置: ' + error)
  } else {
    localStorage.setItem('cloudArchiveConfig', JSON.stringify(config))
    alert('配置成功~')
  }
}

function initUI(config) {
  const target = document.querySelector('#settings > div.reset')
  if (target === null) {
    return {}
  }
  console.log('【云存档】初始化UI...')
  const divLayout = document.createElement('div')
  divLayout.className = 'importExport'

  // 配置按钮
  const initBtn = document.createElement('button')
  initBtn.className = 'button'
  initBtn.appendChild(document.createTextNode(!config.url ? '初始化云存档配置' : '重置云存档配置'))
  initBtn.onclick = initConfig
  divLayout.appendChild(initBtn)

  // 存档列表
  const archiveSelect = document.createElement('select')
  archiveSelect.disabled = !config.url
  archiveSelect.name = 'archiveSelect'
  archiveSelect.className = 'button is-primary'
  archiveSelect.style = 'height: 1.5rem;padding: 0 .75rem;margin: 0.5rem;font-size: 14px;width:160px;'
  archiveSelect.onchange = (e) => {
    const selectNew = !e.target.selectedOptions[0].value
    if (UIHandler.loadBtn) {
      UIHandler.loadBtn.disabled = selectNew
    }
    if (UIHandler.deleteBtn) {
      UIHandler.deleteBtn.disabled = selectNew
    }
  }
  const newArchiveItem = document.createElement('option')
  newArchiveItem.appendChild(document.createTextNode('新存档'))
  newArchiveItem.setAttribute('value', '')
  archiveSelect.appendChild(newArchiveItem)
  archiveSelect.selectedIndex = 0

  divLayout.appendChild(archiveSelect)

  // 新建存档
  const newBtn = document.createElement('button')
  newBtn.className = 'button'
  newBtn.disabled  = !config.url
  newBtn.appendChild(document.createTextNode('上传'))
  newBtn.onclick = saveArchive
  divLayout.appendChild(newBtn)

  // 加载存档
  const loadBtn = document.createElement('button')
  loadBtn.className = 'button'
  loadBtn.disabled = true
  loadBtn.appendChild(document.createTextNode('加载'))
  loadBtn.onclick = loadArchive
  divLayout.appendChild(loadBtn)

  // 加载存档
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'button'
  deleteBtn.disabled = true
  deleteBtn.appendChild(document.createTextNode('删除'))
  deleteBtn.onclick = deleteArchive
  divLayout.appendChild(deleteBtn)

  target.parentElement.insertBefore(divLayout, target)
  return {
    exportBtn: document.querySelector('#settings > div:nth-child(18) > button:nth-child(3)'),
    importBtn: document.querySelector('#settings > div:nth-child(18) > button:nth-child(2)'),
    archiveText: document.querySelector('#importExport'),
    control: divLayout,
    newArchiveItem,
    archiveSelect,
    newBtn, loadBtn, deleteBtn
  }
}

(function () {
  'use strict';
  console.log('【云存档】加载配置...')
  const config = loadConfig()

  const timer = setInterval(()=> {
    UIHandler = initUI(config)
    if (UIHandler.control) {
      clearInterval(timer)
      window.UIHandler = UIHandler
      if (config.url) {
        initClient(config).then((e) => {
          if (!e) {
            console.log('【云存档】初始化配置完毕')
            window.client = client
          } else {
            console.error('【云存档】初始化配置失败', e)
            alert('初始化云存档失败：', e)
          }
        })
      }
    }
  }, 1000)

})();
