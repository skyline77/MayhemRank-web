import type {ComputedRef,InjectionKey,Ref} from 'vue'

export function pageWindow(count:number,page:number,size:number){
 const pageSize=Math.max(1,Math.floor(size))
 const pages=Math.max(1,Math.ceil(Math.max(0,count)/pageSize))
 const current=Math.max(1,Math.min(pages,Math.floor(page)))
 return {page:current,pages,start:(current-1)*pageSize,end:Math.min(count,current*pageSize)}
}
export type PageList={id:symbol;count:number;loading:boolean}
export type DetailPagination={
 enabled:ComputedRef<boolean>;page:Ref<number>;size:ComputedRef<number>
 lists:PageList[]
}
export const detailPaginationKey:InjectionKey<DetailPagination>=Symbol('detail-pagination')
