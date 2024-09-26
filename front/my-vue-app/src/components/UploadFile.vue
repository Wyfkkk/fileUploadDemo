<!--
 * @Author: Wyfkkk 2224081986@qq.com
 * @Date: 2024-09-26 11:10:45
 * @LastEditors: Wyfkkk 2224081986@qq.com
 * @LastEditTime: 2024-09-26 17:32:44
 * @FilePath: \uploadFileMy\front\my-vue-app\src\components\UploadFile.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->

<script setup>
import { reactive, ref } from "vue";
import { uploadFile, checkFile, mergeChunk } from "@/api/index.js";
const uploadFileList = ref([]);
// 切片大小 1 * 1024 * 1024 刚好1M
const chunkSize = ref(1 * 1024 * 1024);
// 最大请求数
const maxRequest = ref(6);
const fileInput = ref(null);
// 生成文件 hash（web-worker）
const useWorker = (file, chunkSize) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("@/worker/hash-worker.js", import.meta.url)
    );
    // 添加处理消息的逻辑
    worker.onmessage = (e) => {
      const { fileHash, fileChunkList } = e.data;
      if (fileHash) {
        resolve({
          fileHash,
          fileChunkList,
        });
      }
    };

    // 添加错误处理
    worker.onerror = (error) => {
      console.error("Worker error:", error);
      reject(new Error("Worker encountered an error"));
    };

    // 启动 Worker 进行文件处理
    worker.postMessage({ file, chunkSize });

    // 完成后终止 Worker
    worker.onmessageend = () => {
      worker.terminate();
    };
  });
};

// 输入框change事件
const hanldeUploadFile = async (e) => {
  const fileEle = e.target
  console.log(fileEle.files);
  // 如果没有文件内容
  if (!fileEle || !fileEle.files || fileEle.files.length === 0) {
    return false
  }
  const files = fileEle.files

  // 多文件
  Array.from(files).forEach(async (item, i) => {
    const file = item
    // 单个上传文件
    // 这里要注意vue2跟vue3不同，
    // 如果在循环 + await中，如果把一个普通对象push进一个响应式数组
    // 直接修改原对象可能不会触发vue的DOM视图更新（但最终值会改变）
    // 所以这里用了reactive做响应式代理
    let inTaskArrItem = reactive({
      id: new Date() + i, // 因为forEach是同步，所以需要用指定id作为唯一标识
      state: 0, // 0是什么都不做,1文件处理中,2是上传中,3是暂停,4是上传完成,5上传中断，6是上传失败
      fileHash: '',
      fileName: file.name,
      fileSize: file.size,
      allChunkList: [], // 所有请求的数据
      whileRequests: [], // 正在请求中的请求个数,目前是要永远都保存请求个数为6
      finishNumber: 0, //请求完成的个数
      errNumber: 0, // 报错的个数,默认是0个,超多3个就是直接上传中断
      percentage: 0, // 单个文件上传进度条
      cancel: null, // 用于取消切片上传接口
    })
    uploadFileList.value.push(inTaskArrItem)
    // 如果不使用reactive，就得使用以下两种方式
    // inTaskArrItem = uploadFileList.value[i]
    // uploadFileList.value[i].state = 2
    // 开始处理解析文件
    inTaskArrItem.state = 1

    if (file.size === 0) {
      // 文件大小为0直接上传失败
      inTaskArrItem.state = 6
      // 上传中断
      pauseUpload(inTaskArrItem, false)
    }
    console.log('文件开始解析')

    // 计算文件hash
    const { fileHash, fileChunkList } = await useWorker(file)

    console.log(fileHash, '文件hash计算完成')

    // 解析完成开始上传文件
    let baseName = ''
    // 查找'.'在fileName中最后出现的位置
    const lastIndex = file.name.lastIndexOf('.')
    // 如果'.'不存在，则返回整个文件名
    if (lastIndex === -1) {
      baseName = file.name
    }
    // 否则，返回从fileName开始到'.'前一个字符的子串作为文件名（不包含'.'）
    baseName = file.name.slice(0, lastIndex)

    // 这里要注意！可能同一个文件，是复制出来的，出现文件名不同但是内容相同，导致获取到的hash值也是相同的
    // 所以文件hash要特殊处理
    inTaskArrItem.fileHash = `${fileHash}${baseName}`
    inTaskArrItem.state = 2
    console.log(uploadFileList.value, 'uploadFileList.value')
    // 上传之前要检查服务器是否存在该文件
    try {
      const res = await checkFile({
        fileHash: `${fileHash}${baseName}`,
        fileName: file.name,
      })

      if (res.code === 0) {
        const { shouldUpload, uploadedList } = res.data

        if (!shouldUpload) {
          finishTask(inTaskArrItem)
          console.log('文件已存在，实现秒传')
          return false
        }

        inTaskArrItem.allChunkList = fileChunkList.map((item, index) => {
          return {
            // 总文件hash
            fileHash: `${fileHash}${baseName}`,
            // 总文件size
            fileSize: file.size,
            // 总文件name
            fileName: file.name,
            index: index,
            // 切片文件本身
            chunkFile: item.chunkFile,
            // 单个切片hash,以 - 连接
            chunkHash: `${fileHash}-${index}`,
            // 切片文件大小
            chunkSize: chunkSize,
            // 切片个数
            chunkNumber: fileChunkList.length,
            // 切片是否已经完成
            finish: false,
          }
        })
        console.log(inTaskArrItem.allChunkList, '=========');

        // 如果已存在部分文件切片，则要过滤调已经上传的切片
        if (uploadedList.length > 0) {
          // 过滤掉已经上传过的切片
          inTaskArrItem.allChunkList = inTaskArrItem.allChunkList.filter(
            (item) => !uploadedList.includes(item.chunkHash)
          )

          // 如果存在需要上传的，但是又为空，可能是因为还没合并，
          if (!inTaskArrItem.allChunkList.length) {
            // 所以需要调用合并接口
            await handleMerge(inTaskArrItem)
            return false
          } else {
            // 同时要注意处理切片数量
            inTaskArrItem.allChunkList = inTaskArrItem.allChunkList.map(
              (item) => {
                return {
                  ...item,
                  chunkNumber: inTaskArrItem.allChunkList.length,
                }
              }
            )
          }
        }
        // 逐步对单个文件进行切片上传
        uploadSignleFile(inTaskArrItem)
      }
    } catch (err) {}
  })
}
</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <div class="card">
      <input
        type="file"
        ref="fileInput"
        @change="hanldeUploadFile"
        accept=""
        multiple="false"
      />

      <el-progress
        :text-inside="true"
        :stroke-width="26"
        :percentage="70"
      ></el-progress>
    </div>
  </div>
</template>

<style>
.upload-drag {
  width: 150px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #fff;
  border: 1px dashed #d8d8d8;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s ease;
}
.upload-drag:hover {
  border: 1px dashed #4595eb;
}
</style>