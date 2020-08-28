import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFirestoreCollection } from '@angular/fire/firestore/public_api';
import { Observable, Subscription } from 'rxjs';
import { NavController, AlertController } from '@ionic/angular';
import { AngularFireStorage } from '@angular/fire/storage';
import { UserService } from './user.service';
import { PopupService } from './popup.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class BookService implements OnDestroy {
  booksCollection: AngularFirestoreCollection<any>;

  curBookId: string;
  curChatId: string;
  langs: string[];
  book: {
    authors: string[],
    cat: string,
    cover: string,
    date: number,
    desc: string,
    id: string,
    lang: string,
    stars: number,
    starsAvg: number,
    starsArray: any[],
    tags: string[],
    title: string,
    titleLower: string,
    verso: string,
    views: number,
    votes: number,
    banner: string,
    wallpaper: string,
    public: boolean,
    main: string
  };

  isAuthor: boolean;

  debug = false;

  bookSub: Subscription;
  bookChatSub: Subscription;
  bookActorSub: Subscription;
  bookPlaceSub: Subscription;
  bookItemSub: Subscription;
  bookTypeSub: Subscription;

  chats: any[] = [];
  actors: any[] = [];
  places: any[] = [];
  items: any[] = [];
  types: any[] = [];

  BOOK: any;
  COMMON: any;
  ERRORS: any;
  bookTradSub: Subscription;
  commonSub: Subscription;

  actorsById: any = {};
  entities: {} = {}; // by id
  // entitiesList: {
  //   id: string,
  //   name: string,
  //   type: string,
  //   roles: string[],
  //   keys: string[],
  //   color: string,
  //   pos: string,
  //   var: {
  //     type: string,
  //     value: any
  //   }[]
  // }[] = [];
  category = [
    'action',
    'adventure',
    'fanfiction',
    'fantastic',
    'fiction',
    'horror',
    'humor',
    'mystery',
    'nonfiction',
    'romance',
    'scifi',
    'thriller'
  ];

  constructor(
    private firestore: AngularFirestore,
    private firestorage: AngularFireStorage,

    private alertController: AlertController,
    private navCtrl: NavController,
    public userService: UserService,
    private popupService: PopupService,
    private translator: TranslateService
  ) {
    this.booksCollection = this.firestore.collection('books');
    this.getTraduction();
  }

  getTraduction() {
    this.bookTradSub = this.translator.get('SERVICES.BOOK').subscribe((val) => {
      this.BOOK = val;
    });
    this.commonSub = this.translator.get('COMMON').subscribe((val) => {
      this.COMMON = val;
    });
    this.translator.get('ERRORS').subscribe((val) => {
      this.ERRORS = val;
    });
  }

  ngOnDestroy() {
    this.bookTradSub.unsubscribe();
    this.commonSub.unsubscribe();
  }

  getBooks(bookIdArray: any[]): Observable<any> {
    if (bookIdArray.length > 0 ) {
      return this.firestore.collection('books', ref => ref.where('id', 'in', bookIdArray)).valueChanges();
    } else {
      return new Observable<any>();
    }
  }

  generateBookId(): string {
    return this.firestore.createId();
  }

  async openBook(bookId) {
    await this.popupService.loading();
    this.curBookId = bookId;
    await this.syncBook();
    this.popupService.loadingDismiss();
    this.navCtrl.navigateForward('/tabs-book');
  }

  async openChat(chatId) {
    this.curChatId = chatId;
    await this.popupService.loading();
    await this.navCtrl.navigateForward('chat');
    this.popupService.loadingDismiss();
  }

  async newBook(book, cover = '', bookId = this.firestore.createId()) {
    await this.popupService.loading(this.COMMON.loading, 'creation');
    // Ajouter l'id référant dans user
    this.userService.addBookRef(bookId);
    // Créer le livre, l'ouvir et y ajouter un chat
    this.firestore.collection('/books').doc(bookId).set(book).then(async () => {
      // Upload le cover si une image est chargée
      if (cover.charAt(0) !== '.') {
        this.uploadCover(cover, bookId);
      }
      await this.navCtrl.pop().then( async () => {
        await this.openCover(bookId);
        await this.openBook(bookId);
        await this.popupService.loadingDismiss('creation');
        this.addChat('main', true);
      }).catch((err) => this.popupService.error(err));
      }
    ).catch((err) => this.popupService.error(err));
  }

  async newChat() {
    await this.popupService.loading();
    const size = await this.getChatsSize();
    await this.popupService.loadingDismiss();
    if (!(size > 10000000)) {
      const alert = await this.alertController.create({
        header: this.BOOK.addChat,
        inputs: [
          {
            name: 'name',
            type: 'text',
            placeholder: this.BOOK.chatName
          }
        ],
        buttons: [
          {
            text: this.COMMON.cancel,
            role: 'cancel',
            cssClass: 'secondary'
          }, {
            text: this.COMMON.create,
            handler: (data) => {
              if (data.name) {
                this.addChat(data.name);
              } else {
                this.popupService.toast(this.BOOK.chatNameError);
              }
            }
          }
        ]
      });
      await alert.present();
    } else {
      this.popupService.alert(this.BOOK.newChatError);
    }
  }

  async getChatsSize() {
    let size = 0;
    this.chats.forEach(chat => {
      chat.logs.forEach(log => {
        size += log.msg.length;
      });
    });
    return size;
  }

  addChat(chatName , main = false) {
    if (chatName.toUpperCase() === 'MAIN' && !main) {
      this.popupService.toast(this.BOOK.chatReservedNameError);
      return;
    }
    if (this.haveChat(chatName)) {
      this.popupService.toast(this.BOOK.chatUsedNameError);
      return;
    }
    let id = 'main';
    if (!main) {
      id = this.firestore.createId();
    }
    if (!this.chats.includes(chatName)) {
      this.firestore.collection('/books').doc(this.curBookId).collection('chats').doc(id).set({id, name: chatName, logs: []}).then(
        () => this.openChat(id)
      ).catch((err) => this.popupService.error(err));
    }
  }

  haveChat(chatName: string): boolean {
    for (const chat of this.chats) {
      if (chat.name.toUpperCase() === chatName.toUpperCase()) {
        return true;
      }
    }
    return false;
  }

  uploadCover(file, bookId = this.curBookId) {
    return new Promise((resolve, reject) => {
      const path = 'books/' + bookId + '/cover.png';
      this.firestorage.ref(path).putString(file, 'data_url').then(async () => {
        const ref = await this.firestorage.ref(path).getDownloadURL().toPromise();
        await this.firestore.collection('books').doc(bookId).update({cover: ref});
        resolve();
      }).catch((err) => {
        this.popupService.error(err);
        reject();
      });
    });
  }

  uploadBanner(file, bookId = this.curBookId): Promise<void> {
    return new Promise((resolve, reject) => {
      const path = 'books/' + bookId + '/banner.png';
      this.firestorage.ref(path).putString(file, 'data_url').then(async () => {
        const ref = await this.firestorage.ref(path).getDownloadURL().toPromise();
        await this.firestore.collection('books').doc(bookId).update({banner: ref});
        resolve();
      }).catch((err) => {
        this.popupService.error(err);
        reject();
      });
    });
  }

  async changeWallpaper(bookId, url: string) {
    await this.firestore.collection('books').doc(bookId).update({wallpaper: url});
    this.popupService.toast(this.BOOK.backgroundChanged);
  }

  searchByName(filter: string): Observable<any> {
    const queryByName = this.firestore.collection(
       'books', ref => ref.where('public', '==', true)
                          .where('lang', 'in', this.userService.langs)
                          .orderBy('titleLower')
                          .startAt(filter.toLowerCase())
                          .endAt(filter.toLowerCase() + '\uf8ff')
                          .limit(20)
      ).valueChanges();
    return queryByName;
  }

  searchByTag(filter: string): Observable<any> {
    const filterArray: string[] = filter.split(' ');
    const res = [];
    filterArray.forEach((val) => {
      res.push(val.toLowerCase());
    });
    const queryByTag = this.firestore.collection(
       'books', ref => ref.where('public', '==', true)
                          .where('tags', 'array-contains-any', res)
                          .limit(20)
      ).valueChanges();
    return queryByTag;
  }

  async deleteBook(bookId = this.curBookId) {
    await this.popupService.loading();
    this.navCtrl.navigateRoot('/tabs/profile');
    // retirer book de la liste
    this.userService.deleteBookRef(bookId);
    // supprimer book
    const bookRef = this.firestore.collection('/books').doc(bookId);
    // S'il n'y a plus d'autheur, le livre est supprimé
    if (this.book.authors.length === 1) {
      this.unsyncBook();
      // On supprime les sous-collections
      const subCollections = ['chats', 'actors', 'comments', 'places', 'items', 'roles'];
      for (const subCollection of subCollections) {
        const data = await this.firestore.collection('books').doc(bookId).collection(subCollection).get().toPromise();
        for (const doc of data.docs) {
          if (doc.exists) {
            await doc.ref.delete();
          }
        }
      }
      // On supprime les médias
      if (this.haveCover()) {
        this.firestorage.ref('books/' + bookId + '/cover.png').delete();
      }
      if (this.haveBanner()) {
        this.firestorage.ref('books/' + bookId + '/banner.png').delete();
      }
      this.firestore.collection('books').doc(bookId).collection('medias').get().subscribe((data) => {
        data.docs.forEach((doc) => {
          // On supprime le média associé à la référence
          const ref = doc.data().ref;
          this.firestorage.ref(ref).delete();
          doc.ref.delete();
        });
      });
      // On supprime le document du livre
      bookRef.delete();
    } else {
      this.removeAuthor(bookId);
    }
    this.popupService.loadingDismiss();
  }

  addMediaRef(url: string, ref: string, type: string, tag: string) {
    this.firestore.collection('books').doc(this.curBookId).collection('medias').add({url, ref, type, tag});
  }

  deleteMedia(url: string) {
    this.firestore.collection('books').doc(this.curBookId)
                  .collection('medias', ref => ref.where('url', '==', url)).get().subscribe((val) => {
      val.docs.forEach(doc => {
        const ref = doc.data().ref;
        this.firestorage.ref(ref).delete();
        doc.ref.delete();
      });
    });
  }

  addAuthor(bookId, userId = this.userService.userId) {
    const bookRef = this.firestore.collection('books').doc(bookId);
    const bookSub = bookRef.get().subscribe((val) => {
      const authors: string[] = val.data().authors;
      if (!authors.includes(userId)) {
        if (authors.length < 10) {
          authors.push(userId);
          bookRef.update({authors});
        } else {
          this.popupService.alert(this.BOOK.authorMaxError);
        }
      } else {
        this.popupService.alert(this.BOOK.authorAlreadyError);
      }
      bookSub.unsubscribe();
    });
  }

  async removeAuthor(bookId, userId = this.userService.userId): Promise<number> {
    let lenAuthors = 0;
    const bookRef = this.firestore.collection('books').doc(bookId);
    const bookPromise = new Promise (res => {
      const bookSub = bookRef.get().subscribe((val) => {
        const authors: string[] = val.data().authors;
        const index = authors.indexOf(userId);
        if (index > -1) {
          authors.splice(index, 1);
          bookRef.update({authors});
        }
        lenAuthors = authors.length;
        bookSub.unsubscribe();
        res();
      });
    });
    await bookPromise;
    return new Promise(result => result(lenAuthors));
  }

  haveCover(): boolean {
    return this.book.cover.charAt(0) !== '.';
  }

  haveBanner(): boolean {
    return this.book.banner !== undefined;
  }

  leaveBook() {
    this.navCtrl.navigateRoot('/tabs/profile');
    const authors = this.book.authors;
    const index = authors.indexOf(this.userService.userId);
    if (index > -1) {
      authors.splice(index, 1);
    }
    // On supprime la ref du livre
    this.userService.deleteBookRef(this.curBookId);
    // On retire l'auteur
    this.updateBookData({authors});
    this.popupService.loadingDismiss();

  }

  getBook(bookId) {
    console.log('REQUETE!');
    return this.firestore.collection('books').doc(bookId).valueChanges();
  }

  updateBookData(data, curBookId: string = this.curBookId) {
    this.booksCollection.doc(curBookId).update(data);
  }

  async syncBook(curBookId = this.curBookId, cover: boolean = false): Promise<any> {
    let bookPromise: Promise<any>;
    bookPromise = new Promise((res, reject) => {
      this.bookSub = this.firestore.collection('books').doc(curBookId).valueChanges().subscribe((value: any) => {
        if (value) {
          this.book = value;
          this.book.starsArray = new Array(Math.round(this.book.starsAvg));
          this.isAuthor = this.book.authors.includes(this.userService.userId) && this.userService.connected;
          res();
        } else {
          reject(this.BOOK.bookNotExistError);
        }
      });
    });
    let bookChatPromise: Promise<any>;
    let bookActorPromise: Promise<any>;
    let bookPlacePromise: Promise<any>;
    let bookItemPromise: Promise<any>;
    let bookTypePromise: Promise<any>;
    if (!cover) {
      bookChatPromise = new Promise(res => {
        this.bookChatSub = this.firestore.collection('books').doc(curBookId).collection('chats').valueChanges().subscribe((value) => {
          this.chats = value;
          console.log(value);
          res();
        });
      });
      bookActorPromise = new Promise(resolve => {
        this.bookActorSub = this.firestore.collection('books').doc(curBookId)
                                          .collection('actors').valueChanges().subscribe((value: any) => {
          this.actorsById = {};
          this.actors = value;
          value.forEach(actor => {
            this.actorsById[actor.id] = actor;
          });
          // Remove all actors
          const res = {};
          Object.values(this.entities).forEach((entity: any) => {
            if (entity.type !== 'actor') {
              res[entity.id] = entity;
            }
          });
          this.entities = res;
          value.forEach(entity => {
            entity.type = 'actor';
            this.entities[entity.id] = entity;
          });
          resolve();
        });
      });
      bookPlacePromise = new Promise(resolve => {
        this.bookActorSub = this.firestore.collection('books').doc(curBookId)
                                          .collection('places').valueChanges().subscribe((value: any) => {
          this.places = value;
          console.log(value);
          // Remove all places
          const res = {};
          Object.values(this.entities).forEach((entity: any) => {
            if (entity.type !== 'place') {
              res[entity.id] = entity;
            }
          });
          this.entities = res;
          value.forEach(entity => {
            entity.type = 'place';
            this.entities[entity.id] = entity;
          });
          resolve();
        });
      });
      bookItemPromise = new Promise(resolve => {
        this.bookActorSub = this.firestore.collection('books').doc(curBookId).collection('items').valueChanges().subscribe((value: any) => {
          this.items = value;
          console.log(value);
          // Remove all items
          const res = {};
          Object.values(this.entities).forEach((entity: any) => {
            if (entity.type !== 'item') {
              res[entity.id] = entity;
            }
          });
          this.entities = res;
          // Replace all items
          value.forEach(entity => {
            entity.type = 'item';
            this.entities[entity.id] = entity;
          });
          resolve();
        });
      });
      bookTypePromise = new Promise(resolve => {
        this.bookActorSub = this.firestore.collection('books').doc(curBookId).collection('types').valueChanges().subscribe((value) => {
          this.types = value;
          console.log(value);
          resolve();
        });
      });
    }
    return new Promise((res, reject) => {
      bookPromise.then(async () => {
        if (!cover) {
          await bookChatPromise;
          await bookActorPromise;
          await bookPlacePromise;
          await bookItemPromise;
          await bookTypePromise;
        }
        res();
      }).catch(err => reject(err));
    });
  }

  unsyncBook(cover = false) {
    this.bookSub.unsubscribe();
    if (!cover) {
      this.bookChatSub.unsubscribe();
      this.bookActorSub.unsubscribe();
      this.bookPlaceSub.unsubscribe();
      this.bookItemSub.unsubscribe();
      this.bookTypeSub.unsubscribe();
    }
  }

  setMainChat(chatId: string) {
    this.firestore.collection('/books').doc(this.curBookId).update({main: chatId})
    .catch((err) => this.popupService.error(err)).then(() => console.log(this.book));
  }

  // uploadFile(type: string, file: any, id= this.userId) {
  //   let path = '';
  //   if (type == 'userAvatar') {
  //     path = 'users/'+ id +'/avatar.png';
  //   }
  //   if (type === 'cover') {
  //     path = 'books/'+ id +'/cover.png';
  //   }
  //   this.firestorage.ref(path).putString(file, 'data_url').then( () => {
  //     if (type === 'userAvatar') {
  //       this.firestorage.ref(path).getDownloadURL().subscribe((ref) => {
  //         this.firestore.collection('users').doc(id).update({avatar: ref});
  //       });
  //     }
  //     if (type === 'cover') {
  //       this.firestorage.ref(path).getDownloadURL().subscribe((ref) => {
  //         this.firestore.collection('books').doc(id).update({cover: ref});
  //       });
  //     }
  //   }
  //   );
  // }

  async publishBook() {
    await this.firestore.collection('/books').doc(this.curBookId).update({public: true});
    await this.firestore.collection('/users').doc(this.userService.userId).collection('books').doc(this.curBookId).update({public: true});
    this.popupService.toast(this.BOOK.bookPublished);
  }

  unpublishBook() {
    this.firestore.collection('/books').doc(this.curBookId).update({public: false});
    this.firestore.collection('/users').doc(this.userService.userId).collection('books').doc(this.curBookId).update({public: false});
  }

  getCategory(category) {
    const res = [];
    const langs = this.userService.userData.searchlangs;
    this.firestore.collection(
      'books',
       ref => ref.where('public', '==', true).where('lang', 'in', langs).where('cat', '==', category).orderBy('views', 'desc').limit(10)
      ).get().subscribe((data) => {
      data.docs.forEach((doc) => {
        res.push(doc.data());
      });
      if (res.length === 0) {
        this.popupService.toast(this.BOOK.emptyCategory);
      }
    });
    return res;
  }

  async openCover(bookId: string) {
    await this.navCtrl.navigateForward('book/' + bookId);
  }

  async play(id = this.curBookId, chatId = 'main', debug = false) {
    await this.popupService.loading();
    this.debug = debug;
    this.curChatId = chatId;
    this.firestore.collection('books').doc(id).update({
      views: this.book.views + 1,
    });
    this.curBookId = id;
    await this.syncBook();
    this.popupService.loadingDismiss();
    this.navCtrl.navigateForward('/game');
  }

  getUserById(userId): Observable<any> {
    return this.firestore.collection('users').doc(userId).get();
  }

  getBookById(bookId): Observable<any> {
    return this.firestore.collection('books').doc(bookId).get();
  }

  shareBook(bookId: string) {
    const bookUrl = 'https://app.noetic.site/book/' + bookId;
    this.userService.share(this.BOOK.shareMsg, this.BOOK.shareSubject, bookUrl);
  }

  newEntity(collection: string, extraData = {}, id = ''): Promise<any> {
    return new Promise(async (res, rej) => {
      const alert = await this.alertController.create({
        header: this.BOOK.header[collection],
        inputs: [
          {
            name: 'name',
            type: 'text',
            placeholder: this.COMMON.name,
          },
        ],
        buttons: [
          {
            text: this.COMMON.cancel,
            role: 'cancel',
            cssClass: 'secondary'
          }, {
            text: this.COMMON.confirm,
            handler: (data: {id: string, name: string, color: string, roles: string[], variables: any[], actions: []}) => {
              if (data.name) {
                data.id = id;
                data.color = 'medium';
                if (id === '') {
                  data.id = this.firestore.createId();
                }
                if (collection === 'roles') {
                  data.variables = [];
                  data.actions = [];
                } else {
                  const role = data.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^\w\s]/gi, '').replace(/\s/g, '-');
                  data.roles = [role];
                  this.firestore.collection('/books').doc(this.curBookId).collection('roles').doc(data.id).set({
                    id: this.firestore.createId(),
                    name: role,
                    color: 'medium',
                    variables: [],
                    actions: []
                  });
                }
                Object.keys(extraData)
                  .forEach(key => data[key] = extraData[key]);
                this.firestore.collection('/books').doc(this.curBookId).collection(collection).doc(data.id).set(data);
                res();
              } else {
                this.popupService.toast(this.ERRORS.fieldMissing);
                rej();
              }
            }
          }
        ]
      });
      await alert.present();
    });
  }

  async updateFieldEntity(id, collection, fields: string[]) {
    const inputs = [];
    for (const field of fields) {
      inputs.push({
        name: field,
        type: 'text',
        placeholder: this.COMMON[field],
      }, );
    }
    const alert = await this.alertController.create({
      header: this.COMMON.update,
      inputs,
      buttons: [
        {
          text: this.COMMON.cancel,
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: this.COMMON.confirm,
          handler: (data) => {
            if (data) {
              this.updateEntity(id, collection, data);
            } else {
              this.popupService.toast(this.ERRORS.fieldMissing);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  updateEntity(id, collection, data): Promise<any> {
    return new Promise((res, rej) => {
      this.firestore.collection('/books').doc(this.curBookId).collection(collection)
                                         .doc(id).update(data).then(() => res()).catch(() => rej());
    });
  }

  uploadAvatar(file, id, collection) {
    const path = 'books/' + this.curBookId + '/' + collection + '/' + id + '/avatar.png';
    this.firestorage.ref(path).putString(file, 'data_url').then( () => {
      this.firestorage.ref(path).getDownloadURL().subscribe((ref) => {
        this.addMediaRef(ref, path, 'image', 'avatar');
        this.firestore.collection('books').doc(this.curBookId).collection(collection).doc(id).update({avatar: ref});
      });
    }).catch((err) => this.popupService.error(err));
  }

  getEntitiesByValues(values: {}): any[] {
    const res = [];
    Object.values(this.entities).forEach(entity => {
      let valid = true;
      Object.keys(values).forEach(variable => {
        if (entity[variable] !== values[variable]) {
          valid = false;
        }
      });
      if (valid) {
        res.push(entity);
      }
    });
    console.log(res);
    return res;
  }

  async deleteEntity(id: string, collection: string) {
    const entity = this.entities[id];
    if (entity) {
      console.log(entity);
      if (entity.avatar) {
        this.deleteMedia(entity.avatar);
      }
      switch (collection) {
        case 'places':
          if (entity.items) {
            for (const idItem of entity.items) {
              this.deleteEntity(idItem, 'items');
            }
          }
          break;
        case 'item':
          const place = this.entities[entity.pos];
          const items: string[] = place.items;
          while (items.indexOf(place) !== -1) {
            const itemIndex = items.indexOf(place);
            items.splice(itemIndex, 1);
          }
          this.updateEntity(place.id, 'place', {items});
          break;
      }
      this.firestore.collection('/books').doc(this.curBookId).collection(collection).doc(id).delete();
    }
  }
}
